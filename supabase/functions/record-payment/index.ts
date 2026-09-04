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
    const body = await jsonBody<{ ledger_id?: string; amount?: number; paid_at?: string; method?: string; reference?: string; note?: string }>(request);
    const amount = body.amount;
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0 || !body.paid_at || !['CASH','BANK_TRANSFER','OTHER'].includes(body.method ?? '')) throw new Error('VALIDATION_ERROR');
    const paidAt = new Date(body.paid_at);
    if (Number.isNaN(paidAt.getTime())) throw new Error('VALIDATION_ERROR');
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'record-payment', () => callRpc(ctx, 'rpc_record_payment', {
      p_ledger_id: requiredUuid(body.ledger_id), p_amount: amount, p_paid_at: paidAt.toISOString(), p_method: requiredString(body.method),
      p_reference: body.reference?.trim() || null, p_note: body.note?.trim() || null, p_trace_id: traceId,
    })), traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
