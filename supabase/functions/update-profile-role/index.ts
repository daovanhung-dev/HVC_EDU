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
    const body = await jsonBody<{ user_id?: string; role?: string; active?: boolean }>(request);
    if (!['ADMIN', 'ACCOUNTANT', 'TEACHER', 'ASSISTANT'].includes(body.role ?? '') || typeof body.active !== 'boolean') throw new Error('VALIDATION_ERROR');
    const data = await runIdempotent(ctx, profile.center_id, request, 'update-profile-role', () => callRpc(ctx, 'rpc_update_profile_role', {
      p_user_id: requiredUuid(body.user_id), p_role: body.role, p_active: body.active, p_trace_id: traceId,
    }));
    return finish(request, ok(data, traceId));
  } catch (error) {
    return errorResponse(error, request, traceId);
  }
}) };
