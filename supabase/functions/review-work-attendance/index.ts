import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ work_attendance_id?: string; decision?: string; check_in_at?: string; check_out_at?: string; rejection_reason?: string; note?: string }>(request);
    const decision = requiredString(body.decision);
    if (!['APPROVED', 'REJECTED'].includes(decision)) throw new Error('VALIDATION_ERROR');
    const result = await runIdempotent(ctx, profile.center_id, request, 'review-work-attendance', () => callRpc(ctx, 'rpc_review_staff_work_attendance', {
      p_work_attendance_id: requiredUuid(body.work_attendance_id), p_decision: decision,
      p_check_in_at: body.check_in_at || null, p_check_out_at: body.check_out_at || null,
      p_rejection_reason: body.rejection_reason?.trim() || null, p_note: body.note?.trim() || null, p_trace_id: traceId,
    }));
    return finish(request, ok(result, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
