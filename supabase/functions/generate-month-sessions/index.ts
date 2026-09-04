import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ class_id?: string; period_id?: string }>(request);
    const data = await runIdempotent(ctx, profile.center_id, request, 'generate-month-sessions', () => callRpc(ctx, 'rpc_generate_month_sessions', {
      p_class_id: requiredUuid(body.class_id), p_period_id: requiredUuid(body.period_id), p_trace_id: traceId,
    }));
    return finish(request, ok(data, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
