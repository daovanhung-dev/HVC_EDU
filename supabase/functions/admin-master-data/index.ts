import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Payload = { operation?: string; [key: string]: unknown };
const optionalUuid = (value: unknown): string | null => value == null || value === '' ? null : requiredUuid(value);
const optionalDate = (value: unknown): string | null => value == null || value === '' ? null : requiredString(value);

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<Payload>(request);
    const operation = requiredString(body.operation);
    let data: unknown;
    switch (operation) {
      case 'UPSERT_STAFF':
        data = await callRpc(ctx, 'rpc_upsert_staff', { p_staff_id: optionalUuid(body.staff_id), p_code: requiredString(body.code), p_full_name: requiredString(body.full_name), p_staff_type: requiredString(body.staff_type), p_phone: body.phone ?? null, p_email: body.email ?? null, p_note: body.note ?? null, p_status: body.status ?? 'ACTIVE', p_trace_id: traceId });
        break;
      case 'UPSERT_CLASS':
        data = await callRpc(ctx, 'rpc_upsert_class', { p_class_id: optionalUuid(body.class_id), p_code: requiredString(body.code), p_name: requiredString(body.name), p_grade: Number(body.grade), p_subject: requiredString(body.subject), p_note: body.note ?? null, p_status: body.status ?? 'ACTIVE', p_trace_id: traceId });
        break;
      case 'UPSERT_STUDENT':
        data = await callRpc(ctx, 'rpc_upsert_student', { p_student_id: optionalUuid(body.student_id), p_code: requiredString(body.code), p_full_name: requiredString(body.full_name), p_phone: body.phone ?? null, p_parent_name: body.parent_name ?? null, p_parent_phone: body.parent_phone ?? null, p_note: body.note ?? null, p_status: body.status ?? 'ACTIVE', p_trace_id: traceId });
        break;
      case 'UPSERT_ENROLLMENT':
        data = await callRpc(ctx, 'rpc_upsert_enrollment', { p_enrollment_id: optionalUuid(body.enrollment_id), p_student_id: requiredUuid(body.student_id), p_class_id: requiredUuid(body.class_id), p_enrolled_from: requiredString(body.enrolled_from), p_enrolled_to: optionalDate(body.enrolled_to), p_status: body.status ?? 'ACTIVE', p_trace_id: traceId });
        break;
      case 'UPSERT_ASSIGNMENT':
        data = await callRpc(ctx, 'rpc_upsert_assignment', { p_assignment_id: optionalUuid(body.assignment_id), p_class_id: requiredUuid(body.class_id), p_staff_id: requiredUuid(body.staff_id), p_role: requiredString(body.role), p_start_date: optionalDate(body.start_date), p_end_date: optionalDate(body.end_date), p_active: body.active ?? true, p_trace_id: traceId });
        break;
      case 'UPSERT_SCHEDULE':
        data = await callRpc(ctx, 'rpc_upsert_schedule', { p_schedule_id: optionalUuid(body.schedule_id), p_class_id: requiredUuid(body.class_id), p_weekday: Number(body.weekday), p_start_time: body.start_time || null, p_end_time: body.end_time || null, p_active: body.active ?? true, p_trace_id: traceId });
        break;
      case 'DEACTIVATE':
        data = await callRpc(ctx, 'rpc_deactivate_entity', { p_entity: requiredString(body.entity), p_id: requiredUuid(body.id), p_trace_id: traceId });
        break;
      default: throw new Error('VALIDATION_ERROR');
    }
    return finish(request, ok(data, traceId, operation.startsWith('UPSERT_') || operation === 'DEACTIVATE' ? 201 : 200));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
