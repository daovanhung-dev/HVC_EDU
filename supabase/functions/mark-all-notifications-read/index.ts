import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx);
    return finish(request, ok(await callRpc(ctx, 'rpc_mark_all_notifications_read', { p_trace_id: traceId }), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
