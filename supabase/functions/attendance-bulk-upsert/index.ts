import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Item = { enrollment_id?: string; status?: string; note?: string | null };
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN', 'STAFF']);
    const body = await jsonBody<{ session_id?: string; rows?: Item[] }>(request);
    const sessionId = requiredUuid(body.session_id);
    if (!Array.isArray(body.rows) || body.rows.length > 100) throw new Error('VALIDATION_ERROR');
    const items = body.rows.map((item) => { if (!['PRESENT', 'ABSENT', 'EXCUSED'].includes(item.status ?? '')) throw new Error('VALIDATION_ERROR'); return { enrollment_id: requiredUuid(item.enrollment_id), status: item.status, note: item.note ?? null }; });
    return finish(request, ok(await callRpc(ctx, 'rpc_upsert_attendance', { p_session_id: sessionId, p_items: items, p_trace_id: traceId }), traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
