import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN', 'ACCOUNTANT']);
    const body = await jsonBody<{ payment_id?: string; reason?: string }>(request);
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'void-payment', () => callRpc(ctx, 'rpc_void_payment', { p_payment_id: requiredUuid(body.payment_id), p_reason: requiredString(body.reason), p_trace_id: traceId })), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
