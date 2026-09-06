import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['TEACHER', 'ASSISTANT']);
    const body = await jsonBody<{ session_id?: string; action?: string; note?: string }>(request);
    const action = requiredString(body.action);
    if (!['CHECK_IN', 'CHECK_OUT'].includes(action)) throw new Error('VALIDATION_ERROR');
    const result = await runIdempotent(ctx, profile.center_id, request, 'submit-work-attendance', () => callRpc(ctx, 'rpc_submit_staff_work_attendance', {
      p_session_id: requiredUuid(body.session_id), p_action: action, p_note: body.note?.trim() || null, p_trace_id: traceId,
    }));
    return finish(request, ok(result, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
