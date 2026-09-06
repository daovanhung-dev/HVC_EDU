import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN', 'STAFF']);
    const body = await jsonBody<{ staff_id?: string; attendance_date?: string; status?: string; note?: string | null }>(request);
    if (!['PRESENT', 'ABSENT', 'LEAVE'].includes(body.status ?? '')) throw new Error('VALIDATION_ERROR');
    const data = await callRpc(ctx, 'rpc_upsert_staff_attendance', { p_staff_id: profile.role === 'ADMIN' && body.staff_id ? requiredUuid(body.staff_id) : null, p_attendance_date: requiredString(body.attendance_date), p_status: body.status, p_note: body.note ?? null, p_trace_id: traceId });
    return finish(request, ok(data, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
