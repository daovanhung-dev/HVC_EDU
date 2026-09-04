import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN', 'ACCOUNTANT']);
    const body = await jsonBody<{ from_period_id?: string; to_period_id?: string }>(request);
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'carry-over-period', () => callRpc(ctx, 'rpc_carry_over_period', { p_from_period_id: requiredUuid(body.from_period_id), p_to_period_id: requiredUuid(body.to_period_id), p_trace_id: traceId })), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
