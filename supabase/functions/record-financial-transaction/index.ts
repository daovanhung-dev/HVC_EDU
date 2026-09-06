import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid, nonNegativeInteger } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ transaction_id?: string; transaction_date?: string; type?: string; category?: string; description?: string; amount?: number }>(request);
    if (!['INCOME', 'EXPENSE'].includes(body.type ?? '')) throw new Error('VALIDATION_ERROR');
    const amount = nonNegativeInteger(body.amount);
    if (amount <= 0) throw new Error('VALIDATION_ERROR');
    const data = await callRpc(ctx, 'rpc_record_financial_transaction', { p_transaction_id: body.transaction_id ? requiredUuid(body.transaction_id) : null, p_transaction_date: requiredString(body.transaction_date), p_type: body.type, p_category: requiredString(body.category), p_description: requiredString(body.description), p_amount: amount, p_trace_id: traceId });
    return finish(request, ok(data, traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
