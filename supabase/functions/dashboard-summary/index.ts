import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type DashboardTask = {
  code: 'ATTENDANCE_PENDING' | 'EVALUATION_PENDING' | 'TUITION_LEDGER_PENDING' | 'PAYROLL_PENDING_APPROVAL' | 'WORK_ATTENDANCE_PENDING' | 'NOTIFICATIONS_UNREAD' | 'INTEGRITY_WARNING';
  count: number;
  severity: 'INFO' | 'WARNING' | 'BLOCKED';
  label: string;
  route: string;
  actionLabel: string;
};

type SessionState = {
  id: string;
  class_id: string;
  session_date: string;
  start_time: string | null;
  status: string;
  class?: { code?: string; name?: string } | null;
  attendanceMarked: boolean;
  evaluationMarked: boolean;
  workAttendanceStatus?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
};

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
    if (!period) return finish(request, ok({ period: null, activeClasses: 0, activeStudents: 0, totalDue: 0, totalPaid: 0, totalDebt: 0, payrollTotal: 0, alerts: [], role: profile.role, tasks: [], upcomingSessions: [], unreadNotificationCount: 0, pendingWorkAttendanceCount: 0 }, traceId));
    const [classes, students, finance, payroll, sessions, enrollments, ledgers, notifications] = await Promise.all([
      ctx.supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      ctx.supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      ctx.supabase.from('v_finance_period_summary').select('*').eq('period_id', period.id).maybeSingle(),
      ctx.supabase.from('payroll_runs').select('total_amount,status').eq('period_id', period.id).maybeSingle(),
      ctx.supabase.from('class_sessions').select('id,class_id,session_date,start_time,status,class:classes(code,name)').eq('period_id', period.id).neq('status', 'CANCELLED').order('session_date', { ascending: true }),
      ctx.supabase.from('enrollments').select('id,class_id,enrolled_from,enrolled_to,status').eq('status', 'ACTIVE'),
      ctx.supabase.from('tuition_ledgers').select('enrollment_id,paid_amount,debt_amount').eq('period_id', period.id),
      ctx.supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    ]);
    if (classes.error) throw classes.error;
    if (students.error) throw students.error;
    if (finance.error && ['ADMIN','ACCOUNTANT'].includes(profile.role)) throw finance.error;
    if (payroll.error && ['ADMIN','ACCOUNTANT'].includes(profile.role)) throw payroll.error;
    if (sessions.error || enrollments.error || ledgers.error || notifications.error) throw sessions.error || enrollments.error || ledgers.error || notifications.error;
    const row = finance.data as Record<string, unknown> | null;
    const totalDue = Number(row?.['tuition_income'] ?? 0);
    let totalPaid = 0;
    let totalDebt = 0;
    if (['ADMIN','ACCOUNTANT'].includes(profile.role)) {
      totalPaid = (ledgers.data ?? []).reduce((sum: number, item: any) => sum + Number(item.paid_amount ?? 0), 0);
      totalDebt = (ledgers.data ?? []).reduce((sum: number, item: any) => sum + Number(item.debt_amount ?? 0), 0);
    }
    const sessionRows = (sessions.data ?? []) as SessionState[];
    const sessionIds = sessionRows.map((item) => item.id);
    const [attendance, evaluations] = await Promise.all([
      sessionIds.length ? ctx.supabase.from('attendance').select('session_id,enrollment_id').in('session_id', sessionIds) : Promise.resolve({ data: [], error: null }),
      sessionIds.length ? ctx.supabase.from('student_session_evaluations').select('session_id,enrollment_id').in('session_id', sessionIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (attendance.error) throw attendance.error;
    if (evaluations.error) throw evaluations.error;
    const workAttendance = sessionIds.length
      ? await ctx.supabase.from('staff_work_attendance').select('session_id,staff_id,status,check_in_at,check_out_at').in('session_id', sessionIds)
      : { data: [], error: null };
    if (workAttendance.error) throw workAttendance.error;
    const workBySession = new Map<string, any>();
    for (const item of workAttendance.data ?? []) {
      if (item.staff_id === profile.staff_id || !workBySession.has(item.session_id)) workBySession.set(item.session_id, item);
    }
    const attendanceBySession = new Map<string, Set<string>>();
    const evaluationBySession = new Map<string, Set<string>>();
    for (const row of attendance.data ?? []) {
      const rows = attendanceBySession.get(row.session_id) ?? new Set<string>();
      rows.add(row.enrollment_id);
      attendanceBySession.set(row.session_id, rows);
    }
    for (const row of evaluations.data ?? []) {
      const rows = evaluationBySession.get(row.session_id) ?? new Set<string>();
      rows.add(row.enrollment_id);
      evaluationBySession.set(row.session_id, rows);
    }
    const alerts: string[] = [];
    const activeEnrollments = (enrollments.data ?? []).filter((item: any) => item.enrolled_from <= period.end_date && (!item.enrolled_to || item.enrolled_to >= period.start_date));
    const today = new Date().toISOString().slice(0, 10);
    const sessionStates = sessionRows.map((session) => {
      const roster = activeEnrollments.filter((enrollment: any) => enrollment.class_id === session.class_id && enrollment.enrolled_from <= session.session_date && (!enrollment.enrolled_to || enrollment.enrolled_to >= session.session_date));
      const attendanceRows = attendanceBySession.get(session.id) ?? new Set<string>();
      const evaluationRows = evaluationBySession.get(session.id) ?? new Set<string>();
      const attendanceMarked = roster.length > 0 && roster.every((enrollment: any) => attendanceRows.has(enrollment.id));
      const evaluationMarked = roster.length > 0 && roster.every((enrollment: any) => evaluationRows.has(enrollment.id));
      const work = workBySession.get(session.id);
      return { ...session, attendanceMarked, evaluationMarked, workAttendanceStatus: work?.status ?? null, checkInAt: work?.check_in_at ?? null, checkOutAt: work?.check_out_at ?? null };
    });
    const pendingAttendanceCount = sessionStates.filter((session) => (session.status === 'COMPLETED' || session.session_date < today) && activeEnrollments.some((enrollment: any) => enrollment.class_id === session.class_id && enrollment.enrolled_from <= session.session_date && (!enrollment.enrolled_to || enrollment.enrolled_to >= session.session_date)) && !session.attendanceMarked).length;
    const pendingEvaluationCount = sessionStates.filter((session) => (session.status === 'COMPLETED' || session.session_date < today) && activeEnrollments.some((enrollment: any) => enrollment.class_id === session.class_id && enrollment.enrolled_from <= session.session_date && (!enrollment.enrolled_to || enrollment.enrolled_to >= session.session_date)) && !session.evaluationMarked).length;
    if (pendingAttendanceCount > 0 && ['ADMIN', 'TEACHER', 'ASSISTANT'].includes(profile.role)) alerts.push('Có buổi học chưa được điểm danh đầy đủ');
    const ledgerIds = new Set((ledgers.data ?? []).map((item: any) => item.enrollment_id));
    if (['ADMIN','ACCOUNTANT'].includes(profile.role) && activeEnrollments.some((item: any) => !ledgerIds.has(item.id))) alerts.push('Có enrollment active chưa có ledger');
    if (['ADMIN','ACCOUNTANT'].includes(profile.role) && (!payroll.data || payroll.data.status !== 'APPROVED')) alerts.push('Payroll chưa được duyệt');
    const pendingWorkAttendanceCount = (workAttendance.data ?? []).filter((item: any) => ['SUBMITTED', 'IN_PROGRESS', 'REJECTED'].includes(item.status)).length;
    const unreadNotificationCount = notifications.count ?? 0;
    if (profile.role === 'ADMIN' && pendingWorkAttendanceCount > 0) alerts.push('Có công theo buổi đang chờ duyệt');
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
    const tasks: DashboardTask[] = [];
    if (['ADMIN', 'TEACHER', 'ASSISTANT'].includes(profile.role) && pendingAttendanceCount > 0) tasks.push({ code: 'ATTENDANCE_PENDING', count: pendingAttendanceCount, severity: 'WARNING', label: 'Buổi học chưa điểm danh', route: '/attendance', actionLabel: 'Mở danh sách buổi' });
    if (['ADMIN', 'TEACHER', 'ASSISTANT'].includes(profile.role) && pendingEvaluationCount > 0) tasks.push({ code: 'EVALUATION_PENDING', count: pendingEvaluationCount, severity: 'INFO', label: 'Buổi học chưa đánh giá', route: '/attendance', actionLabel: 'Mở danh sách đánh giá' });
    const missingLedgerCount = ['ADMIN', 'ACCOUNTANT'].includes(profile.role) ? activeEnrollments.filter((item: any) => !ledgerIds.has(item.id)).length : 0;
    if (missingLedgerCount > 0) tasks.push({ code: 'TUITION_LEDGER_PENDING', count: missingLedgerCount, severity: 'WARNING', label: 'Enrollment chưa có ledger', route: '/finance/tuition', actionLabel: 'Kiểm tra học phí' });
    if (['ADMIN', 'ACCOUNTANT'].includes(profile.role) && (!payroll.data || payroll.data.status !== 'APPROVED')) tasks.push({ code: 'PAYROLL_PENDING_APPROVAL', count: 1, severity: 'BLOCKED', label: 'Payroll chưa được duyệt', route: '/payroll', actionLabel: 'Mở payroll' });
    if (profile.role === 'ADMIN' && pendingWorkAttendanceCount > 0) tasks.push({ code: 'WORK_ATTENDANCE_PENDING', count: pendingWorkAttendanceCount, severity: 'WARNING', label: 'Công chờ duyệt', route: '/staff?tab=work-approval', actionLabel: 'Duyệt công' });
    if (unreadNotificationCount > 0) tasks.push({ code: 'NOTIFICATIONS_UNREAD', count: unreadNotificationCount, severity: 'INFO', label: 'Thông báo chưa đọc', route: '/notifications', actionLabel: 'Mở inbox' });
    if (alerts.length > 0 && ['ADMIN', 'ACCOUNTANT'].includes(profile.role)) tasks.push({ code: 'INTEGRITY_WARNING', count: alerts.length, severity: 'WARNING', label: 'Cảnh báo cần kiểm tra', route: '/periods', actionLabel: 'Kiểm tra dữ liệu' });
    const upcomingSessions = sessionStates.filter((session) => session.session_date >= today).slice(0, 5).map((session) => ({
      id: session.id,
      class_id: session.class_id,
      class_code: session.class?.code ?? '',
      class_name: session.class?.name ?? '',
      session_date: session.session_date,
      start_time: session.start_time,
      status: session.status,
      attendance_marked: session.attendanceMarked,
      evaluation_marked: session.evaluationMarked,
      work_attendance_status: session.workAttendanceStatus,
      check_in_at: session.checkInAt,
      check_out_at: session.checkOutAt,
    }));
    return finish(request, ok({ period, activeClasses: classes.count ?? 0, activeStudents: students.count ?? 0,
      totalDue, totalPaid, totalDebt, payrollTotal, otherIncome, otherExpense, rewards, profitBeforeFund,
      fundContribution, distributableProfit, alerts, role: profile.role, tasks, upcomingSessions, unreadNotificationCount, pendingWorkAttendanceCount }, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
