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
    const body = await jsonBody<{ period_id?: string; transaction_date?: string; type?: string; category?: string; description?: string; amount?: number; class_id?: string; attachment_path?: string }>(request);
    if (!body.transaction_date || !['INCOME','EXPENSE'].includes(body.type ?? '') || typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount <= 0) throw new Error('VALIDATION_ERROR');
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'record-financial-transaction', () => callRpc(ctx, 'rpc_record_financial_transaction', {
      p_period_id: requiredUuid(body.period_id), p_transaction_date: body.transaction_date, p_type: requiredString(body.type), p_category: requiredString(body.category), p_description: requiredString(body.description), p_amount: body.amount,
      p_class_id: body.class_id ? requiredUuid(body.class_id) : null, p_attachment_path: body.attachment_path?.trim() || null, p_trace_id: traceId,
    })), traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
