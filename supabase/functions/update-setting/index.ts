import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ key?: string; value_json?: unknown }>(request);
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'update-setting', () => callRpc(ctx, 'rpc_upsert_setting', { p_key: requiredString(body.key), p_value_json: body.value_json ?? {}, p_trace_id: traceId })), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
