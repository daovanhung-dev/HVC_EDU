import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Payload = { period_id?: string; dry_run?: boolean };
type PayrollItem = {
  staff_id: string;
  class_id: string;
  role: 'MAIN_TEACHER' | 'ASSISTANT';
  class_revenue: number | string;
  sessions_taught: number;
  applied_percent: string;
  base_amount: number | string;
  bonus: number | string;
  penalty: number | string;
  final_amount: number | string;
};

function asBigInt(value: unknown): bigint {
  const text = String(value ?? '0');
  if (!/^-?\d+$/.test(text)) throw new Error('VALIDATION_ERROR');
  return BigInt(text);
}

function decimalFraction(value: unknown): { numerator: bigint; denominator: bigint } {
  const text = String(value ?? '0').trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('VALIDATION_ERROR');
  const [whole, fraction = ''] = text.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  return { numerator: BigInt(whole + fraction), denominator };
}

function floorFraction(value: bigint, numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error('VALIDATION_ERROR');
  return (value * numerator) / denominator;
}

function floorRatio(value: bigint, ratio: unknown): bigint {
  const { numerator, denominator } = decimalFraction(ratio);
  return floorFraction(value, numerator, denominator);
}

function floorToStep(value: bigint, step: bigint): bigint {
  return step > 0n ? (value / step) * step : value;
}

function asJsonMoney(value: bigint): number | string {
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  return value <= maxSafe && value >= -maxSafe ? Number(value) : value.toString();
}

function requireResult<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

function jsonSetting(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.replace(/^"|"$/g, '');
  return fallback;
}

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN', 'ACCOUNTANT']);
    const body = await jsonBody<Payload>(request);
    const periodId = requiredUuid(body.period_id);
    const period = requireResult<any>(await ctx.supabase.from('accounting_periods').select('*').eq('id', periodId).maybeSingle());
    if (!period) throw new Error('PERIOD_NOT_FOUND');
    if (period.status !== 'OPEN') throw new Error('PERIOD_NOT_OPEN');

    const masterPolicy = requireResult<any>(await ctx.supabase
      .from('payroll_policies')
      .select('id,name,teacher_percent,assistant_percent,max_total_percent,rounding_step,effective_from,effective_to')
      .lte('effective_from', period.start_date)
      .or(`effective_to.is.null,effective_to.gte.${period.start_date}`)
      .eq('active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle());
    if (!masterPolicy) throw new Error('PAYROLL_POLICY_NOT_FOUND');

    const [enrollmentResult, ledgerResult, sessionResult, assignmentResult, basisResult, snapshotPolicyResult] = await Promise.all([
      ctx.supabase.from('enrollments').select('id,class_id').eq('status', 'ACTIVE'),
      ctx.supabase.from('tuition_ledgers').select('enrollment_id,amount_due').eq('period_id', periodId),
      ctx.supabase.from('class_sessions').select('id,class_id').eq('period_id', periodId).neq('status', 'CANCELLED'),
      ctx.supabase.from('class_assignments').select('class_id,staff_id,role,planned_sessions,start_date,end_date,period_id'),
      ctx.supabase.from('period_settings').select('value_json').eq('period_id', periodId).eq('key', 'payroll_basis').maybeSingle(),
      ctx.supabase.from('period_settings').select('value_json').eq('period_id', periodId).eq('key', 'payroll_policy').maybeSingle(),
    ]);
    const enrollments = requireResult<any[]>(enrollmentResult) ?? [];
    const ledgers = requireResult<any[]>(ledgerResult) ?? [];
    const sessions = requireResult<any[]>(sessionResult) ?? [];
    const assignments = (requireResult<any[]>(assignmentResult) ?? []).filter((item: any) =>
      (!item.period_id || item.period_id === periodId) &&
      item.start_date <= period.end_date &&
      (!item.end_date || item.end_date >= period.start_date));
    const basisRow = requireResult<any>(basisResult);
    const workAttendanceBasis = jsonSetting(basisRow?.value_json, 'LEGACY_ASSIGNMENT');
    const snapshotPolicyRow = requireResult<any>(snapshotPolicyResult);
    const snapshotPolicy = snapshotPolicyRow?.value_json;
    const policy = snapshotPolicy && typeof snapshotPolicy === 'object' && snapshotPolicy.teacher_percent !== undefined && snapshotPolicy.assistant_percent !== undefined
      ? { ...masterPolicy, ...snapshotPolicy }
      : masterPolicy;

    const enrollmentClass = new Map<string, string>();
    for (const enrollment of enrollments as any[]) enrollmentClass.set(enrollment.id, enrollment.class_id);
    const classRevenue = new Map<string, bigint>();
    for (const ledger of ledgers as any[]) {
      const classId = enrollmentClass.get(ledger.enrollment_id);
      if (classId) classRevenue.set(classId, (classRevenue.get(classId) ?? 0n) + asBigInt(ledger.amount_due));
    }
    const classSessions = new Map<string, number>();
    const sessionClass = new Map<string, string>();
    for (const session of sessions as any[]) {
      classSessions.set(session.class_id, (classSessions.get(session.class_id) ?? 0) + 1);
      sessionClass.set(session.id, session.class_id);
    }
    const approvedWorkByStaffClass = new Map<string, number>();
    let workAttendanceCount = 0;
    if (workAttendanceBasis === 'APPROVED_WORK_ATTENDANCE' && sessions.length) {
      const work = requireResult<any[]>(await ctx.supabase.from('staff_work_attendance').select('session_id,staff_id').eq('status', 'APPROVED').in('session_id', sessions.map((item: any) => item.id)));
      for (const item of work ?? []) {
        workAttendanceCount += 1;
        const classId = sessionClass.get(item.session_id);
        if (!classId) continue;
        const key = `${item.staff_id}:${classId}`;
        approvedWorkByStaffClass.set(key, (approvedWorkByStaffClass.get(key) ?? 0) + 1);
      }
    }

    const teacherPercent = String(policy.teacher_percent);
    const assistantPercent = String(policy.assistant_percent);
    const maxTotalPercent = policy.max_total_percent;
    const roundingStep = asBigInt(policy.rounding_step);
    const rawByClass = new Map<string, Array<{ assignment: any; raw: bigint; percent: string; sessions: number }>>();
    for (const assignment of assignments as any[]) {
      const percent = assignment.role === 'ASSISTANT' ? assistantPercent : teacherPercent;
      const sessionsInClass = classSessions.get(assignment.class_id) ?? 0;
      const workCount = approvedWorkByStaffClass.get(`${assignment.staff_id}:${assignment.class_id}`) ?? 0;
      const sessionsTaught = workAttendanceBasis === 'APPROVED_WORK_ATTENDANCE'
        ? workCount
        : Math.max(0, Number(assignment.planned_sessions ?? sessionsInClass));
      const coverage = sessionsInClass > 0 ? { numerator: BigInt(Math.min(sessionsTaught, sessionsInClass)), denominator: BigInt(sessionsInClass) } : { numerator: 1n, denominator: 1n };
      const revenue = classRevenue.get(assignment.class_id) ?? 0n;
      const raw = floorFraction(floorRatio(revenue, percent), coverage.numerator, coverage.denominator);
      const entries = rawByClass.get(assignment.class_id) ?? [];
      entries.push({ assignment, raw, percent, sessions: sessionsTaught });
      rawByClass.set(assignment.class_id, entries);
    }

    const items: PayrollItem[] = [];
    for (const [classId, entries] of rawByClass) {
      const revenue = classRevenue.get(classId) ?? 0n;
      const cap = floorRatio(revenue, maxTotalPercent);
      const rawTotal = entries.reduce((sum, item) => sum + item.raw, 0n);
      const scaleNumerator = rawTotal > cap && rawTotal > 0n ? cap : rawTotal;
      const scaleDenominator = rawTotal > cap && rawTotal > 0n ? rawTotal : 1n;
      for (const entry of entries) {
        const scaled = scaleDenominator === 1n ? entry.raw : (entry.raw * scaleNumerator) / scaleDenominator;
        const finalAmount = floorToStep(scaled, roundingStep);
        items.push({
          staff_id: entry.assignment.staff_id,
          class_id: classId,
          role: entry.assignment.role,
          class_revenue: asJsonMoney(revenue),
          sessions_taught: entry.sessions,
          applied_percent: entry.percent,
          base_amount: asJsonMoney(finalAmount),
          bonus: 0,
          penalty: 0,
          final_amount: asJsonMoney(finalAmount),
        });
      }
    }

    const total = items.reduce((sum, item) => sum + asBigInt(item.final_amount), 0n);
    let saved: unknown = null;
    if (!body.dry_run) {
      saved = await runIdempotent(ctx, profile.center_id, request, 'calculate-payroll', async () => {
        const result = await callRpc(ctx, 'rpc_save_payroll_run', { p_period_id: periodId, p_items: items, p_trace_id: traceId });
        await callRpc(ctx, 'rpc_publish_admin_notification', {
          p_type: 'PAYROLL_PENDING_APPROVAL',
          p_title: 'Payroll cần duyệt',
          p_message: `Payroll tháng ${period.month}/${period.year} đã được tính và đang chờ Admin duyệt.`,
          p_severity: 'WARNING',
          p_action_route: '/finance?tab=payroll',
          p_metadata: { period_id: periodId, payroll_run_id: (result as any)?.payroll_run_id ?? null },
          p_dedupe_key: `PAYROLL_PENDING_APPROVAL:${periodId}`,
          p_trace_id: traceId,
        });
        return result;
      });
    }
    return finish(request, ok({
      period_id: periodId,
      dry_run: body.dry_run !== false,
      policy,
      items,
      total_amount: asJsonMoney(total),
      work_attendance_basis: workAttendanceBasis,
      approved_work_attendance_count: workAttendanceCount,
      saved,
      payroll_run_id: (saved as any)?.payroll_run_id ?? null,
    }, traceId));
  } catch (error) {
    return errorResponse(error, request, traceId);
  }
}) };
