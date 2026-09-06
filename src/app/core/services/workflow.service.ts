import { Injectable } from '@angular/core';
import { EdgeFunctionService } from '../api/edge-function.service';
import { SupabaseService } from '../supabase/supabase.service';

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
  period_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  class?: { code: string; name: string } | null;
  work_attendance?: WorkAttendance | null;
};

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
    return this.edge.invoke('create-month-setup', payload, `month-setup:${String((payload['period'] as any)?.year)}-${String((payload['period'] as any)?.month)}`);
  }

  async teachingSessions(periodId: string, from?: string, to?: string): Promise<TeachingSession[]> {
    let query: any = this.supabase.client.from('class_sessions').select('id,class_id,period_id,session_date,start_time,end_time,status,class:classes(code,name)').eq('period_id', periodId).order('session_date').order('start_time');
    if (from) query = query.gte('session_date', from);
    if (to) query = query.lte('session_date', to);
    const sessions = await query;
    if (sessions.error) throw sessions.error;
    const rows = (sessions.data ?? []) as TeachingSession[];
    const ids = rows.map((row) => row.id);
    if (!ids.length) return rows;
    const work = await this.supabase.client.from('staff_work_attendance').select('*').in('session_id', ids);
    if (work.error) throw work.error;
    const workMap = new Map((work.data ?? []).map((row: WorkAttendance) => [row.session_id, row]));
    return rows.map((row) => ({ ...row, work_attendance: workMap.get(row.id) ?? null }));
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
