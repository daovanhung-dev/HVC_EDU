import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx);
    const body = await jsonBody<{ period_id?: string }>(request);
    const periodQuery = ctx.supabase.from('accounting_periods').select('id,year,month,status,start_date,end_date').order('year', { ascending: false }).order('month', { ascending: false }).limit(1);
    if (body.period_id) periodQuery.eq('id', body.period_id);
    const { data: periods, error: periodError } = await periodQuery;
    if (periodError) throw periodError;
    const period = periods?.[0] as { id: string; year: number; month: number; status: string; start_date: string; end_date: string } | undefined;
    if (!period) return finish(request, ok({ period: null, activeClasses: 0, activeStudents: 0, totalDue: 0, totalPaid: 0, totalDebt: 0, payrollTotal: 0, alerts: [], role: profile.role }, traceId));
    const [classes, students, finance, payroll, sessions, enrollments, ledgers] = await Promise.all([
      ctx.supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      ctx.supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      ctx.supabase.from('v_finance_period_summary').select('*').eq('period_id', period.id).maybeSingle(),
      ctx.supabase.from('payroll_runs').select('total_amount,status').eq('period_id', period.id).maybeSingle(),
      ctx.supabase.from('class_sessions').select('id,status').eq('period_id', period.id).neq('status', 'CANCELLED'),
      ctx.supabase.from('enrollments').select('id,enrolled_from,enrolled_to,status').eq('status', 'ACTIVE'),
      ctx.supabase.from('tuition_ledgers').select('enrollment_id,paid_amount,debt_amount').eq('period_id', period.id),
    ]);
    if (classes.error) throw classes.error;
    if (students.error) throw students.error;
    if (finance.error && ['ADMIN','ACCOUNTANT'].includes(profile.role)) throw finance.error;
    if (payroll.error && ['ADMIN','ACCOUNTANT'].includes(profile.role)) throw payroll.error;
    if (sessions.error || enrollments.error || ledgers.error) throw sessions.error || enrollments.error || ledgers.error;
    const row = finance.data as Record<string, unknown> | null;
    const totalDue = Number(row?.['tuition_income'] ?? 0);
    let totalPaid = 0;
    let totalDebt = 0;
    if (['ADMIN','ACCOUNTANT'].includes(profile.role)) {
      totalPaid = (ledgers.data ?? []).reduce((sum: number, item: any) => sum + Number(item.paid_amount ?? 0), 0);
      totalDebt = (ledgers.data ?? []).reduce((sum: number, item: any) => sum + Number(item.debt_amount ?? 0), 0);
    }
    const sessionIds = (sessions.data ?? []).map((item: any) => item.id);
    const attendance = sessionIds.length ? await ctx.supabase.from('attendance').select('session_id').in('session_id', sessionIds) : { data: [], error: null };
    if (attendance.error) throw attendance.error;
    const markedIds = new Set((attendance.data ?? []).map((item: any) => item.session_id));
    const alerts: string[] = [];
    if (sessionIds.some((id: string) => !markedIds.has(id))) alerts.push('Có buổi học chưa được điểm danh');
    const activeEnrollments = (enrollments.data ?? []).filter((item: any) => item.enrolled_from <= period.end_date && (!item.enrolled_to || item.enrolled_to >= period.start_date));
    const ledgerIds = new Set((ledgers.data ?? []).map((item: any) => item.enrollment_id));
    if (['ADMIN','ACCOUNTANT'].includes(profile.role) && activeEnrollments.some((item: any) => !ledgerIds.has(item.id))) alerts.push('Có enrollment active chưa có ledger');
    if (['ADMIN','ACCOUNTANT'].includes(profile.role) && (!payroll.data || payroll.data.status !== 'APPROVED')) alerts.push('Payroll chưa được duyệt');
    const otherIncome = Number(row?.['other_income'] ?? 0);
    const otherExpense = Number(row?.['other_expense'] ?? 0);
    const rewards = Number(row?.['student_rewards'] ?? 0);
    const payrollTotal = Number((payroll.data as any)?.total_amount ?? row?.['payroll'] ?? 0);
    const profitBeforeFund = totalDue + otherIncome - payrollTotal - rewards - otherExpense;
    const settingClient = ctx.supabaseAdmin ?? ctx.supabase;
    const fundSetting = ['ADMIN','ACCOUNTANT'].includes(profile.role) ? await settingClient.from('system_settings').select('value_json').eq('center_id', profile.center_id).eq('key', 'fund').maybeSingle() : { data: null, error: null };
    if (fundSetting.error && ['ADMIN','ACCOUNTANT'].includes(profile.role)) throw fundSetting.error;
    const fundPercent = Number(fundSetting.data?.value_json?.fund_percent ?? 0.10);
    const fundContribution = Math.floor(Math.max(0, profitBeforeFund) * fundPercent);
    const distributableProfit = Math.max(0, profitBeforeFund - fundContribution);
    return finish(request, ok({ period, activeClasses: classes.count ?? 0, activeStudents: students.count ?? 0,
      totalDue, totalPaid, totalDebt, payrollTotal, otherIncome, otherExpense, rewards, profitBeforeFund,
      fundContribution, distributableProfit, alerts, role: profile.role }, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
