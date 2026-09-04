import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Item = { enrollment_id?: string; status?: string; note?: string | null };
type Payload = { session_id?: string; items?: Item[] };

export default {
  fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
    const traceId = crypto.randomUUID();
    if (request.method === 'OPTIONS') return preflight(request);
    try {
      const { userId, profile } = await requireProfile(ctx, ['ADMIN', 'TEACHER', 'ASSISTANT']);
      const body = await jsonBody<Payload>(request);
      const sessionId = requiredUuid(body.session_id);
      if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) throw new Error('VALIDATION_ERROR');
      const items = body.items.map((item) => {
        const enrollmentId = requiredUuid(item.enrollment_id);
        if (!['PRESENT', 'ABSENT', 'EXCUSED'].includes(item.status ?? '')) throw new Error('VALIDATION_ERROR');
        return { enrollment_id: enrollmentId, status: item.status, note: item.note ?? null };
      });
      const data = await runIdempotent(ctx, profile.center_id, request, 'attendance-bulk-upsert', async () => {
        const { data, error } = await ctx.supabase.rpc('rpc_bulk_attendance', {
          p_session_id: sessionId, p_items: items, p_trace_id: traceId,
        });
        if (error) throw error;
        return data;
      });
      return finish(request, ok({ ...((data ?? {}) as Record<string, unknown>), actor_id: userId }, traceId));
    } catch (error) {
      return errorResponse(error, request, traceId);
    }
  }),
};
