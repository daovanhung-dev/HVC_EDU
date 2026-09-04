import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ period_id?: string; recipient_name?: string; recipient_user_id?: string; ratio?: number }>(request);
    if (typeof body.ratio !== 'number' || body.ratio < 0 || body.ratio > 1) throw new Error('VALIDATION_ERROR');
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'update-profit-distribution', () => callRpc(ctx, 'rpc_upsert_profit_distribution', { p_period_id: requiredUuid(body.period_id), p_recipient_name: requiredString(body.recipient_name), p_recipient_user_id: body.recipient_user_id ? requiredUuid(body.recipient_user_id) : null, p_ratio: body.ratio, p_trace_id: traceId })), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
