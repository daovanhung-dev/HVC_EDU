import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN','ACCOUNTANT']);
    const body = await jsonBody<{ period_id?: string }>(request);
    const periodId = requiredUuid(body.period_id);
    const { data: period, error: periodError } = await ctx.supabase.from('accounting_periods').select('*').eq('id', periodId).maybeSingle();
    if (periodError) throw periodError;
    if (!period) throw new Error('PERIOD_NOT_FOUND');
    const [sessions, ledgers, payroll, distributions, finance, enrollments, transactions] = await Promise.all([
      ctx.supabase.from('class_sessions').select('id,status').eq('period_id', periodId).neq('status','CANCELLED'),
      ctx.supabase.from('tuition_ledgers').select('id,enrollment_id,status').eq('period_id', periodId),
      ctx.supabase.from('payroll_runs').select('status,total_amount').eq('period_id', periodId).maybeSingle(),
      ctx.supabase.from('profit_distributions').select('ratio,amount').eq('period_id', periodId),
      ctx.supabase.from('v_finance_period_summary').select('*').eq('period_id', periodId).maybeSingle(),
      ctx.supabase.from('enrollments').select('id,enrolled_from,enrolled_to,status,class:classes!inner(center_id)').eq('status','ACTIVE'),
      ctx.supabase.from('financial_transactions').select('id,transaction_date,type,category,description,amount').eq('period_id', periodId),
    ]);
    for (const result of [sessions,ledgers,payroll,distributions,finance,enrollments,transactions]) if (result.error) throw result.error;
    const sessionIds: string[] = (sessions.data ?? []).map((row: any) => String(row.id));
    let markedIds = new Set<string>();
    if (sessionIds.length > 0) {
      const marked = await ctx.supabase.from('attendance').select('session_id').in('session_id', sessionIds);
      if (marked.error) throw marked.error;
      markedIds = new Set((marked.data ?? []).map((row: any) => row.session_id));
    }
    const relevantEnrollments = (enrollments.data ?? []).filter((row: any) =>
      row.enrolled_from <= period.end_date && (!row.enrolled_to || row.enrolled_to >= period.start_date));
    const ledgerEnrollmentIds = new Set((ledgers.data ?? []).map((row: any) => row.enrollment_id));
    const blockers: string[] = [];
    if (sessionIds.length === 0) blockers.push('NO_SESSIONS');
    if (sessionIds.some((id) => !markedIds.has(id))) blockers.push('MISSING_ATTENDANCE');
    if (relevantEnrollments.some((row: any) => !ledgerEnrollmentIds.has(row.id))) blockers.push('MISSING_TUITION_LEDGER');
    if ((ledgers.data ?? []).some((row: any) => row.status === 'DRAFT')) blockers.push('LEDGER_NOT_CONFIRMED');
    if ((transactions.data ?? []).some((row: any) => !row.transaction_date || !row.type || !row.category || !row.description || Number(row.amount) <= 0)) blockers.push('INVALID_TRANSACTION_METADATA');
    if (!payroll.data || payroll.data.status !== 'APPROVED') blockers.push('PAYROLL_NOT_APPROVED');
    const ratio = (distributions.data ?? []).reduce((sum: number, row: any) => sum + Number(row.ratio ?? 0), 0);
    if ((distributions.data ?? []).length === 0 || Math.abs(ratio - 1) > 0.0001) blockers.push('PROFIT_RATIO_INVALID');
    const financeRow = finance.data as any;
    const payrollTotal = Number(payroll.data?.total_amount ?? financeRow?.payroll ?? 0);
    const profitBeforeFund = Number(financeRow?.tuition_income ?? 0) + Number(financeRow?.other_income ?? 0) - payrollTotal - Number(financeRow?.student_rewards ?? 0) - Number(financeRow?.other_expense ?? 0);
    const settingClient = ctx.supabaseAdmin ?? ctx.supabase;
    const fundSetting = await settingClient.from('system_settings').select('value_json').eq('center_id', (period as any).center_id).eq('key', 'fund').maybeSingle();
    if (fundSetting.error && ctx.supabaseAdmin) throw fundSetting.error;
    const fundPercent = Number(fundSetting.data?.value_json?.fund_percent ?? 0.10);
    const fundContribution = Math.floor(Math.max(0, profitBeforeFund) * fundPercent);
    return finish(request, ok({ period, blockers, can_close: blockers.length === 0, payroll: payroll.data, distributions: distributions.data ?? [], finance: finance.data, ledger_count: ledgers.data?.length ?? 0, profit_before_fund: profitBeforeFund, fund_percent: fundPercent, fund_contribution: fundContribution, distributable_profit: Math.max(0, profitBeforeFund - fundContribution) }, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
