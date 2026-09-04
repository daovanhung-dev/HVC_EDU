import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ period_id?: string }>(request);
    const periodId = requiredUuid(body.period_id);
    const issues: Array<{ code: string; severity: 'ERROR' | 'WARNING'; message: string; details?: unknown }> = [];
    const [sessions, attendance, enrollments, ledgers, transactions, payroll, distributions, adjustments, students] = await Promise.all([
      ctx.supabase.from('class_sessions').select('id,class_id,status').eq('period_id', periodId).neq('status', 'CANCELLED'),
      ctx.supabase.from('attendance').select('session_id,enrollment_id,status'),
      ctx.supabase.from('enrollments').select('id,student_id,class_id,status'),
      ctx.supabase.from('tuition_ledgers').select('id,enrollment_id,amount_due,paid_amount,debt_amount').eq('period_id', periodId),
      ctx.supabase.from('financial_transactions').select('id,transaction_date,type,category,description,amount').eq('period_id', periodId),
      ctx.supabase.from('payroll_runs').select('id,status,total_amount').eq('period_id', periodId).maybeSingle(),
      ctx.supabase.from('profit_distributions').select('ratio').eq('period_id', periodId),
      ctx.supabase.from('tuition_adjustments').select('enrollment_id,type,amount,source_period_id').eq('period_id', periodId),
      ctx.supabase.from('students').select('id,status'),
    ]);
    for (const result of [sessions, attendance, enrollments, ledgers, transactions, payroll, distributions, adjustments, students]) if (result.error) throw result.error;

    const sessionRows = sessions.data ?? [];
    const sessionIds = new Set(sessionRows.map((row: any) => row.id));
    const sessionClass = new Map(sessionRows.map((row: any) => [row.id, row.class_id]));
    const attendanceRows = (attendance.data ?? []).filter((row: any) => sessionIds.has(row.session_id));
    const markedIds = new Set(attendanceRows.map((row: any) => row.session_id));
    if (sessionRows.some((row: any) => !markedIds.has(row.id))) issues.push({ code: 'DI-04', severity: 'ERROR', message: 'Có buổi học chưa được điểm danh' });

    const enrollmentRows = enrollments.data ?? [];
    const enrollmentIds = new Set(enrollmentRows.map((row: any) => row.id));
    const enrollmentClass = new Map(enrollmentRows.map((row: any) => [row.id, row.class_id]));
    const activeEnrollmentIds = new Set(enrollmentRows.filter((row: any) => row.status === 'ACTIVE').map((row: any) => row.id));
    if ((ledgers.data ?? []).some((row: any) => !enrollmentIds.has(row.enrollment_id))) issues.push({ code: 'DI-02', severity: 'ERROR', message: 'Ledger tham chiếu enrollment không hợp lệ' });
    const ledgerMap = new Map((ledgers.data ?? []).map((row: any) => [row.enrollment_id, row]));
    if (enrollmentRows.some((row: any) => row.status === 'ACTIVE' && !ledgerMap.has(row.id))) issues.push({ code: 'DI-01', severity: 'WARNING', message: 'Enrollment active chưa có ledger' });
    const activeStudentIds = new Set((students.data ?? []).filter((row: any) => row.status === 'ACTIVE').map((row: any) => row.id));
    if (enrollmentRows.some((row: any) => row.status === 'ACTIVE' && !activeStudentIds.has(row.student_id))) issues.push({ code: 'DI-03', severity: 'WARNING', message: 'Enrollment active tham chiếu học sinh không active' });
    if (attendanceRows.some((row: any) => sessionClass.get(row.session_id) !== enrollmentClass.get(row.enrollment_id))) issues.push({ code: 'DI-05', severity: 'ERROR', message: 'Attendance có enrollment không thuộc lớp của session' });

    if ((transactions.data ?? []).some((row: any) => !row.transaction_date || !row.type || !row.category || !row.description || Number(row.amount) <= 0)) issues.push({ code: 'DI-06', severity: 'ERROR', message: 'Giao dịch tài chính thiếu metadata' });
    if ((ledgers.data ?? []).some((row: any) => Number(row.debt_amount) !== Math.max(0, Number(row.amount_due) - Number(row.paid_amount)))) issues.push({ code: 'DI-10', severity: 'ERROR', message: 'Công thức công nợ không khớp' });

    const ledgerIds = (ledgers.data ?? []).map((row: any) => row.id);
    if (ledgerIds.length) {
      const paymentResult = await ctx.supabase.from('payments').select('tuition_ledger_id,amount,voided_at').in('tuition_ledger_id', ledgerIds);
      if (paymentResult.error) throw paymentResult.error;
      const paidByLedger = new Map<string, number>();
      for (const payment of paymentResult.data ?? []) if (!payment.voided_at) paidByLedger.set(payment.tuition_ledger_id, (paidByLedger.get(payment.tuition_ledger_id) ?? 0) + Number(payment.amount ?? 0));
      if ((ledgers.data ?? []).some((ledger: any) => (paidByLedger.get(ledger.id) ?? 0) !== Number(ledger.paid_amount ?? 0))) issues.push({ code: 'DI-09', severity: 'ERROR', message: 'Tổng payment active không khớp paid_amount của ledger' });
    }

    if (payroll.data) {
      const itemResult = await ctx.supabase.from('payroll_items').select('class_id,class_revenue,final_amount').eq('payroll_run_id', payroll.data.id);
      if (itemResult.error) throw itemResult.error;
      const itemTotal = (itemResult.data ?? []).reduce((sum: number, row: any) => sum + Number(row.final_amount ?? 0), 0);
      if (itemTotal !== Number(payroll.data.total_amount)) issues.push({ code: 'DI-08', severity: 'ERROR', message: 'Tổng payroll không khớp chi tiết' });
      const policyResult = await ctx.supabase.from('payroll_policies').select('max_total_percent').eq('active', true).order('effective_from', { ascending: false }).limit(1).maybeSingle();
      if (policyResult.error) throw policyResult.error;
      const byClass = new Map<string, { revenue: number; total: number }>();
      for (const item of itemResult.data ?? []) { const current = byClass.get(item.class_id) ?? { revenue: Number(item.class_revenue), total: 0 }; current.total += Number(item.final_amount); byClass.set(item.class_id, current); }
      if (policyResult.data && [...byClass.values()].some((value) => value.total > Math.floor(value.revenue * Number(policyResult.data.max_total_percent)))) issues.push({ code: 'DI-07', severity: 'ERROR', message: 'Payroll vượt cap theo chính sách' });
    }

    const ratios = (distributions.data ?? []).reduce((sum: number, row: any) => sum + Number(row.ratio ?? 0), 0);
    if ((distributions.data ?? []).length > 0 && Math.abs(ratios - 1) > 0.0001) issues.push({ code: 'DI-12', severity: 'ERROR', message: 'Tỷ lệ chia lợi nhuận không bằng 100%' });
    const carryKeys = new Set<string>();
    for (const row of adjustments.data ?? []) if (row.type === 'CARRY_IN' && row.source_period_id) { const key = `${row.enrollment_id}:${row.source_period_id}`; if (carryKeys.has(key)) issues.push({ code: 'DI-11', severity: 'ERROR', message: 'Carry-over bị trùng' }); carryKeys.add(key); }
    return finish(request, ok({ issues, summary: { errorCount: issues.filter((item) => item.severity === 'ERROR').length, warningCount: issues.filter((item) => item.severity === 'WARNING').length }, active_enrollment_count: activeEnrollmentIds.size }, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
