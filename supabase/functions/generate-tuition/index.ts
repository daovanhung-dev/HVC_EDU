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
    const body = await jsonBody<{ period_id?: string; class_id?: string }>(request);
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'generate-tuition', () => callRpc(ctx, 'rpc_generate_tuition', { p_period_id: requiredUuid(body.period_id), p_class_id: body.class_id ? requiredUuid(body.class_id) : null, p_trace_id: traceId })), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
