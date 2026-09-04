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
    const body = await jsonBody<{ payroll_run_id?: string }>(request);
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'approve-payroll', () => callRpc(ctx, 'rpc_approve_payroll', { p_payroll_run_id: requiredUuid(body.payroll_run_id), p_trace_id: traceId })), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
