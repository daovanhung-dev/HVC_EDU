import { Injectable } from '@angular/core';
import { EdgeFunctionService } from '../api/edge-function.service';
import { SupabaseService } from '../supabase/supabase.service';
import { datesInRange, isoWeekday, scheduleAppliesOn, scheduleOccurrenceKey } from '../utils/teaching-schedule.util';

export type WorkAttendanceStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type WorkAttendanceAction = 'CHECK_IN' | 'CHECK_OUT';

export type WorkAttendance = {
  id: string;
  session_id: string;
  staff_id: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: WorkAttendanceStatus;
  rejection_reason?: string | null;
  note?: string | null;
  staff?: { id: string; code: string; full_name: string } | null;
  session?: { id: string; class_id: string; session_date: string; start_time: string | null; class?: { code: string; name: string } | null } | null;
};

export type TeachingSession = {
  id: string;
  class_id: string;
  session_id: string | null;
  schedule_id: string | null;
  period_id: string | null;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  source: 'SESSION' | 'WEEKLY_SCHEDULE';
  class?: { code: string; name: string } | null;
  work_attendance?: WorkAttendance | null;
};

type RelatedClass = { code: string; name: string } | { code: string; name: string }[] | null;

type TeachingSessionRow = {
  id: string;
  class_id: string;
  period_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  class?: RelatedClass;
};

type WeeklyScheduleRow = {
  id: string;
  class_id: string;
  weekday: number;
  start_time: string | null;
  end_time: string | null;
  effective_from: string;
  effective_to: string | null;
  active: boolean;
  class?: RelatedClass;
};

type PeriodWindow = { id: string; start_date: string; end_date: string };

export type MonthSetupPreview = {
  source_period: { id: string; year: number; month: number; start_date: string; end_date: string; status: string } | null;
  classes: any[];
  class_configs: any[];
  students: any[];
  schedules: any[];
  assignments: any[];
  policy: any;
  settings: any[];
  payroll_basis: string;
};

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  constructor(private readonly supabase: SupabaseService, private readonly edge: EdgeFunctionService) {}

  async monthSetupPreview(sourcePeriodId?: string): Promise<MonthSetupPreview> {
    return this.edge.invoke<MonthSetupPreview>('month-setup-preview', sourcePeriodId ? { source_period_id: sourcePeriodId } : {});
  }

  async createMonthSetup(payload: Record<string, unknown>): Promise<any> {
    const period = payload['period'] as { year?: unknown; month?: unknown } | undefined;
    const idempotencyKey = `month-setup:${String(period?.year)}-${String(period?.month)}`;
    // Supabase's browser gateway does not allow x-idempotency-key in CORS preflight.
    // Keep the same server-side idempotency guard by sending the key as JSON instead.
    return this.edge.invoke('create-month-setup', { ...payload, idempotency_key: idempotencyKey });
  }

  async teachingSessions(periodId: string, from?: string, to?: string): Promise<TeachingSession[]> {
    let query: any = this.supabase.client.from('class_sessions').select('id,class_id,period_id,session_date,start_time,end_time,status,class:classes(code,name)').eq('period_id', periodId).order('session_date').order('start_time');
    if (from) query = query.gte('session_date', from);
    if (to) query = query.lte('session_date', to);
    const sessions = await query;
    if (sessions.error) throw sessions.error;
    return this.withWorkAttendance((sessions.data ?? []).map((row: TeachingSessionRow) => this.realSession(row)));
  }

  async teachingSession(sessionId: string): Promise<TeachingSession | null> {
    const result = await this.supabase.client
      .from('class_sessions')
      .select('id,class_id,period_id,session_date,start_time,end_time,status,class:classes(code,name)')
      .eq('id', sessionId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return null;
    const [session] = await this.withWorkAttendance([this.realSession(result.data as TeachingSessionRow)]);
    return session ?? null;
  }

  async teachingSchedule(from: string, to: string): Promise<TeachingSession[]> {
    const [periodsResult, schedulesResult] = await Promise.all([
      this.supabase.client.from('accounting_periods').select('id,start_date,end_date').lte('start_date', to).gte('end_date', from),
      this.supabase.client.from('class_schedules').select('id,class_id,weekday,start_time,end_time,effective_from,effective_to,active,class:classes(code,name)').eq('active', true).order('weekday').order('start_time'),
    ]);
    if (periodsResult.error) throw periodsResult.error;
    if (schedulesResult.error) throw schedulesResult.error;

    const periods = (periodsResult.data ?? []) as PeriodWindow[];
    const periodIds = periods.map((period) => period.id);
    let sessionRows: TeachingSessionRow[] = [];
    if (periodIds.length) {
      const sessions = await this.supabase.client
        .from('class_sessions')
        .select('id,class_id,period_id,session_date,start_time,end_time,status,class:classes(code,name)')
        .in('period_id', periodIds)
        .gte('session_date', from)
        .lte('session_date', to)
        .order('session_date')
        .order('start_time');
      if (sessions.error) throw sessions.error;
      sessionRows = (sessions.data ?? []) as TeachingSessionRow[];
    }

    const realRows = sessionRows.map((row) => this.realSession(row));
    const realKeys = new Set(realRows.map((row) => scheduleOccurrenceKey(row.class_id, row.session_date, row.start_time)));
    const dates = datesInRange(from, to);
    const plannedRows: TeachingSession[] = [];
    for (const schedule of (schedulesResult.data ?? []) as WeeklyScheduleRow[]) {
      for (const date of dates) {
        if (Number(schedule.weekday) !== isoWeekday(date) || !scheduleAppliesOn(schedule, date)) continue;
        const key = scheduleOccurrenceKey(schedule.class_id, date, schedule.start_time);
        if (realKeys.has(key)) continue;
        plannedRows.push({
          id: `weekly:${schedule.id}:${date}`,
          session_id: null,
          schedule_id: schedule.id,
          class_id: schedule.class_id,
          period_id: periods.find((period) => period.start_date <= date && period.end_date >= date)?.id ?? null,
          session_date: date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          status: 'SCHEDULED',
          source: 'WEEKLY_SCHEDULE',
          class: this.relatedClass(schedule.class),
          work_attendance: null,
        });
      }
    }

    return this.withWorkAttendance([...realRows, ...plannedRows].sort((left, right) => {
      const leftKey = `${left.session_date}|${left.start_time ?? '99:99:99'}|${left.class?.code ?? ''}`;
      const rightKey = `${right.session_date}|${right.start_time ?? '99:99:99'}|${right.class?.code ?? ''}`;
      return leftKey.localeCompare(rightKey);
    }));
  }

  private realSession(row: TeachingSessionRow): TeachingSession {
    return {
      id: row.id,
      class_id: row.class_id,
      period_id: row.period_id,
      session_date: row.session_date,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      session_id: row.id,
      schedule_id: null,
      source: 'SESSION',
      class: this.relatedClass(row.class),
      work_attendance: null,
    };
  }

  private relatedClass(value: RelatedClass | undefined): { code: string; name: string } | null {
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  }

  private async withWorkAttendance(rows: TeachingSession[]): Promise<TeachingSession[]> {
    const ids = rows.filter((row) => row.source === 'SESSION' && row.session_id).map((row) => row.session_id as string);
    if (!ids.length) return rows;
    const work = await this.supabase.client.from('staff_work_attendance').select('*').in('session_id', ids);
    if (work.error) throw work.error;
    const workMap = new Map((work.data ?? []).map((row: WorkAttendance) => [row.session_id, row]));
    return rows.map((row) => ({ ...row, work_attendance: row.session_id ? workMap.get(row.session_id) ?? null : null }));
  }

  async workApprovalQueue(periodId: string): Promise<WorkAttendance[]> {
    const result = await this.supabase.client.from('staff_work_attendance')
      .select('*,staff:staff(id,code,full_name),session:class_sessions!inner(id,class_id,period_id,session_date,start_time,class:classes(code,name))')
      .eq('status', 'SUBMITTED')
      .eq('session.period_id', periodId)
      .order('submitted_at');
    if (result.error) throw result.error;
    return (result.data ?? []) as WorkAttendance[];
  }

  submitWorkAttendance(sessionId: string, action: WorkAttendanceAction, note?: string): Promise<WorkAttendance> {
    return this.edge.invoke<WorkAttendance>('submit-work-attendance', { session_id: sessionId, action, note: note || undefined }, `work:${sessionId}:${action}`);
  }

  reviewWorkAttendance(payload: { work_attendance_id: string; decision: 'APPROVED' | 'REJECTED'; check_in_at?: string; check_out_at?: string; rejection_reason?: string }): Promise<WorkAttendance> {
    return this.edge.invoke<WorkAttendance>('review-work-attendance', payload, `work-review:${payload.work_attendance_id}:${payload.decision}:${Date.now()}`);
  }

  saveAvailability(payload: { staff_id?: string; availability_date: string; start_time: string; end_time: string; note?: string }): Promise<any> {
    return this.edge.invoke('save-staff-availability', payload, `availability:${payload.staff_id ?? 'self'}:${payload.availability_date}:${payload.start_time}:${payload.end_time}`);
  }

  async availability(staffId: string, from: string, to: string): Promise<any[]> {
    const result = await this.supabase.client.from('staff_availability').select('*').eq('staff_id', staffId).gte('availability_date', from).lte('availability_date', to).order('availability_date').order('start_time');
    if (result.error) throw result.error;
    return result.data ?? [];
  }
}
