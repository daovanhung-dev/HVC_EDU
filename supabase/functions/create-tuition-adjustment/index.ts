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
    const body = await jsonBody<{ enrollment_id?: string; period_id?: string; type?: string; amount?: number; reason?: string; source_period_id?: string }>(request);
    if (typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount < 0 || !['DISCOUNT','CARRY_IN','CARRY_OUT','OPENING_DEBT','MANUAL'].includes(body.type ?? '')) throw new Error('VALIDATION_ERROR');
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'create-tuition-adjustment', () => callRpc(ctx, 'rpc_create_tuition_adjustment', {
      p_enrollment_id: requiredUuid(body.enrollment_id), p_period_id: requiredUuid(body.period_id), p_type: requiredString(body.type), p_amount: body.amount,
      p_reason: requiredString(body.reason), p_source_period_id: body.source_period_id ? requiredUuid(body.source_period_id) : null, p_trace_id: traceId,
    })), traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
