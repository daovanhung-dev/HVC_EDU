import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Evaluation = { enrollment_id?: string; homework_score?: number | null; understanding_score?: number | null; attitude_score?: number | null; learning_gap?: string | null; comment?: string | null };
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN', 'TEACHER', 'ASSISTANT']);
    const body = await jsonBody<{ session_id?: string; items?: Evaluation[] }>(request);
    const sessionId = requiredUuid(body.session_id);
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) throw new Error('VALIDATION_ERROR');
    const items = body.items.map((item) => ({
      enrollment_id: requiredUuid(item.enrollment_id), homework_score: item.homework_score ?? null,
      understanding_score: item.understanding_score ?? null, attitude_score: item.attitude_score ?? null,
      learning_gap: item.learning_gap ?? null, comment: item.comment ?? null,
    }));
    return finish(request, ok(await runIdempotent(ctx, profile.center_id, request, 'evaluation-bulk-upsert', () => callRpc(ctx, 'rpc_bulk_evaluation', { p_session_id: sessionId, p_items: items, p_trace_id: traceId })), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
