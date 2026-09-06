import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ scope?: string; role?: string; recipient_user_id?: string; title?: string; message?: string; severity?: string; action_route?: string; metadata?: Record<string, unknown>; dedupe_key?: string }>(request);
    const result = await runIdempotent(ctx, profile.center_id, request, 'send-notification', () => callRpc(ctx, 'rpc_send_notification', {
      p_scope: body.scope, p_role: body.role || null, p_recipient_user_id: body.recipient_user_id ? requiredUuid(body.recipient_user_id) : null,
      p_title: body.title, p_message: body.message, p_severity: body.severity || 'INFO', p_action_route: body.action_route || null,
      p_metadata: body.metadata || {}, p_dedupe_key: body.dedupe_key || null, p_trace_id: traceId,
    }));
    return finish(request, ok(result, traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
