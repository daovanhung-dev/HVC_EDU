import { withSupabase } from 'npm:@supabase/server@^1';
import { ok, fail } from '../_shared/response.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (_req, ctx) => {
    const traceId = crypto.randomUUID();
    try {
      const userId = ctx.userClaims?.sub;
      if (!userId) return fail(401, 'UNAUTHENTICATED', 'Không xác định được người dùng', null, traceId);

      const { data: profile, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('center_id,role,active')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile?.active) return fail(403, 'FORBIDDEN', 'Tài khoản chưa được kích hoạt', null, traceId);

      const [classes, students, ledgers] = await Promise.all([
        ctx.supabase.from('classes').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        ctx.supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        ctx.supabase.from('tuition_ledgers').select('amount_due,paid_amount,debt_amount'),
      ]);

      if (classes.error) throw classes.error;
      if (students.error) throw students.error;
      if (ledgers.error && !['TEACHER','ASSISTANT'].includes(profile.role)) throw ledgers.error;

      const financeRows = ledgers.data ?? [];
      const sums = financeRows.reduce(
        (acc, row) => ({
          totalDue: acc.totalDue + Number(row.amount_due ?? 0),
          totalPaid: acc.totalPaid + Number(row.paid_amount ?? 0),
          totalDebt: acc.totalDebt + Number(row.debt_amount ?? 0),
        }),
        { totalDue: 0, totalPaid: 0, totalDebt: 0 },
      );

      return ok({ activeClasses: classes.count ?? 0, activeStudents: students.count ?? 0, ...sums }, traceId);
    } catch (error) {
      console.error(traceId, error);
      return fail(500, 'INTERNAL_ERROR', 'Không thể tải tổng quan', null, traceId);
    }
  }),
};
