import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ from_date?: string; to_date?: string }>(request);
    const data = await callRpc(ctx, 'rpc_generate_sessions', { p_from_date: requiredString(body.from_date), p_to_date: requiredString(body.to_date), p_trace_id: traceId });
    return finish(request, ok(data, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
