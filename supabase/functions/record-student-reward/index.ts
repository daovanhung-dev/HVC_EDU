import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN','ACCOUNTANT']);
    const body = await jsonBody<{ period_id?: string; student_id?: string; class_id?: string; amount?: number; reason?: string; note?: string }>(request);
    if (typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount < 0) throw new Error('VALIDATION_ERROR');
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'record-student-reward', () => callRpc(ctx, 'rpc_record_student_reward', {
      p_period_id: requiredUuid(body.period_id), p_student_id: requiredUuid(body.student_id), p_amount: body.amount, p_reason: requiredString(body.reason),
      p_class_id: body.class_id ? requiredUuid(body.class_id) : null, p_note: body.note?.trim() || null, p_trace_id: traceId,
    })), traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
