import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ year?: number; month?: number; start_date?: string; end_date?: string }>(request);
    if (!Number.isInteger(body.year) || !Number.isInteger(body.month) || !body.start_date || !body.end_date) throw new Error('VALIDATION_ERROR');
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'create-period', () => callRpc(ctx, 'rpc_create_period', { p_year: body.year, p_month: body.month, p_start_date: body.start_date, p_end_date: body.end_date, p_trace_id: traceId })), traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
