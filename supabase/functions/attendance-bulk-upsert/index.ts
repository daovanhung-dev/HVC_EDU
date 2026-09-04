import { withSupabase } from 'npm:@supabase/server@^1';
import { ok, fail } from '../_shared/response.ts';

const ALLOWED = new Set(['PRESENT', 'ABSENT', 'EXCUSED']);

type Item = { enrollment_id: string; status: string; note?: string | null };
type Payload = { session_id?: string; items?: Item[] };

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    const traceId = crypto.randomUUID();
    try {
      const userId = ctx.userClaims?.sub;
      if (!userId) return fail(401, 'UNAUTHENTICATED', 'Không xác định được người dùng', null, traceId);

      const body = (await req.json()) as Payload;
      if (!body.session_id || !Array.isArray(body.items) || body.items.length === 0) {
        return fail(400, 'VALIDATION_ERROR', 'session_id và items[] là bắt buộc', null, traceId);
      }
      if (body.items.length > 100) return fail(400, 'TOO_MANY_ITEMS', 'Tối đa 100 học sinh mỗi request', null, traceId);
      if (body.items.some((item) => !item.enrollment_id || !ALLOWED.has(item.status))) {
        return fail(400, 'VALIDATION_ERROR', 'Dữ liệu điểm danh không hợp lệ', null, traceId);
      }

      const { data: session, error: sessionError } = await ctx.supabase
        .from('class_sessions')
        .select('id,class_id,period_id')
        .eq('id', body.session_id)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!session) return fail(404, 'SESSION_NOT_FOUND', 'Không tìm thấy buổi học', null, traceId);

      const { data: profile, error: profileError } = await ctx.supabase
        .from('profiles').select('role,staff_id,active,center_id').eq('user_id', userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.active) return fail(403, 'FORBIDDEN', 'Tài khoản không hoạt động', null, traceId);

      if (profile.role !== 'ADMIN') {
        const { data: assignment, error: assignmentError } = await ctx.supabase
          .from('class_assignments')
          .select('id')
          .eq('class_id', session.class_id)
          .eq('staff_id', profile.staff_id)
          .limit(1)
          .maybeSingle();
        if (assignmentError) throw assignmentError;
        if (!assignment) return fail(403, 'FORBIDDEN', 'Bạn không được phân công lớp này', null, traceId);
      }

      const { data: period, error: periodError } = await ctx.supabase
        .from('accounting_periods').select('status').eq('id', session.period_id).maybeSingle();
      if (periodError) throw periodError;
      if (period?.status === 'CLOSED') return fail(409, 'PERIOD_CLOSED', 'Kỳ kế toán đã đóng', null, traceId);

      // For MVP, upsert is RLS-scoped. A DB RPC transaction is recommended when audit is added.
      const rows = body.items.map((item) => ({
        session_id: body.session_id,
        enrollment_id: item.enrollment_id,
        status: item.status,
        note: item.note ?? null,
        marked_by: userId,
        marked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await ctx.supabaseAdmin.from('attendance').upsert(rows, { onConflict: 'session_id,enrollment_id' });
      if (upsertError) throw upsertError;

      const { error: auditError } = await ctx.supabaseAdmin.from('audit_logs').insert({
        center_id: profile.center_id,
        actor_user_id: userId,
        action: 'ATTENDANCE_BULK_UPSERT',
        resource_type: 'class_session',
        resource_id: body.session_id,
        after_data: { saved: rows.length },
        trace_id: traceId,
      });
      if (auditError) console.warn(traceId, 'audit failed', auditError.message);

      return ok({ sessionId: body.session_id, saved: rows.length, failed: 0 }, traceId);
    } catch (error) {
      console.error(traceId, error);
      return fail(500, 'INTERNAL_ERROR', 'Không thể lưu điểm danh', null, traceId);
    }
  }),
};
