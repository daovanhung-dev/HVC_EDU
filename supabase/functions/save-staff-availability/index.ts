import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx);
    const body = await jsonBody<{ staff_id?: string; availability_date?: string; start_time?: string; end_time?: string; note?: string }>(request);
    const result = await runIdempotent(ctx, profile.center_id, request, 'save-staff-availability', () => callRpc(ctx, 'rpc_upsert_staff_availability', {
      p_staff_id: body.staff_id ? requiredUuid(body.staff_id) : null, p_availability_date: body.availability_date,
      p_start_time: body.start_time, p_end_time: body.end_time, p_note: body.note?.trim() || null, p_trace_id: traceId,
    }));
    return finish(request, ok(result, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
