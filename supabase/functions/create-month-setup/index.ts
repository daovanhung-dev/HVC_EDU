import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile, runIdempotent } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Payload = {
  idempotency_key?: string;
  source_period_id?: string | null;
  period?: Record<string, unknown>;
  class_configs?: unknown[];
  enrollment_actions?: unknown[];
  schedules?: unknown[];
  assignments?: unknown[];
  settings?: Record<string, unknown>;
  carry_over?: boolean;
  new_classes?: unknown[];
};

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<Payload>(request);
    if (!body.period || typeof body.period !== 'object') throw new Error('VALIDATION_ERROR');
    const result = await runIdempotent(ctx, profile.center_id, request, 'create-month-setup', () => callRpc(ctx, 'rpc_create_month_setup', {
      p_source_period_id: body.source_period_id ? requiredUuid(body.source_period_id) : null,
      p_period: body.period,
      p_class_configs: body.class_configs ?? [],
      p_enrollment_actions: body.enrollment_actions ?? [],
      p_schedules: body.schedules ?? [],
      p_assignments: body.assignments ?? [],
      p_settings: body.settings ?? {},
      p_carry_over: body.carry_over !== false,
      p_trace_id: traceId,
      p_new_classes: body.new_classes ?? [],
    }), body);
    return finish(request, ok(result, traceId, 201));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
