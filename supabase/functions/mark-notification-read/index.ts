import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx);
    const body = await jsonBody<{ notification_id?: string }>(request);
    return finish(request, ok(await callRpc(ctx, 'rpc_mark_notification_read', { p_notification_id: requiredUuid(body.notification_id), p_trace_id: traceId }), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
