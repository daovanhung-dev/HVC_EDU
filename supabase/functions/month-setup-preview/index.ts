import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<{ source_period_id?: string }>(request);
    const sourceId = body.source_period_id ? requiredUuid(body.source_period_id) : null;
    const periodQuery = ctx.supabase.from('accounting_periods').select('id,year,month,start_date,end_date,status').eq('center_id', profile.center_id).order('start_date', { ascending: false }).limit(1);
    if (sourceId) periodQuery.eq('id', sourceId);
    const source = await periodQuery.maybeSingle();
    if (source.error) throw source.error;
    const sourcePeriod = source.data ?? null;
    const [classes, students, schedules, assignments, policy, settings, configs] = await Promise.all([
      ctx.supabase.from('classes').select('id,code,name,grade,subject,standard_unit_fee,collection_method,status,note').eq('center_id', profile.center_id).order('grade').order('code'),
      ctx.supabase.from('students').select('id,code,full_name,phone,parent_name,parent_phone,status,enrollments(id,class_id,enrolled_from,enrolled_to,status,unit_price_override,tuition_exempt,note)').eq('center_id', profile.center_id).order('full_name'),
      ctx.supabase.from('class_schedules').select('id,class_id,weekday,start_time,end_time,effective_from,effective_to,active').order('weekday').order('start_time'),
      ctx.supabase.from('class_assignments').select('id,class_id,staff_id,period_id,role,planned_sessions,start_date,end_date,staff:staff(id,code,full_name,staff_type),class:classes(id,code,name)').eq('period_id', sourcePeriod?.id ?? '00000000-0000-0000-0000-000000000000'),
      ctx.supabase.from('payroll_policies').select('id,name,teacher_percent,assistant_percent,max_total_percent,rounding_step,effective_from,effective_to').eq('center_id', profile.center_id).eq('active', true).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.from('system_settings').select('key,value_json').eq('center_id', profile.center_id),
      sourcePeriod ? ctx.supabase.from('period_class_configs').select('period_id,class_id,active,unit_fee,collection_method,note').eq('period_id', sourcePeriod.id) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [classes, students, schedules, assignments, policy, settings, configs]) if (result.error) throw result.error;
    const classRows = (classes.data ?? []).filter((row: any) => row.status === 'ACTIVE');
    const configRows = (configs.data ?? []) as any[];
    const configMap = new Map(configRows.map((row: any) => [row.class_id, row]));
    const classConfigs = classRows.map((row: any) => {
      const config = configMap.get(row.id);
      return { class_id: row.id, active: config?.active ?? true, unit_fee: config?.unit_fee ?? row.standard_unit_fee, collection_method: config?.collection_method ?? row.collection_method, note: config?.note ?? row.note };
    });
    const assignmentRows = assignments.data ?? [];
    return finish(request, ok({
      source_period: sourcePeriod,
      classes: classRows,
      class_configs: classConfigs,
      students: students.data ?? [],
      schedules: schedules.data ?? [],
      assignments: assignmentRows,
      policy: policy.data ?? null,
      settings: settings.data ?? [],
      payroll_basis: 'APPROVED_WORK_ATTENDANCE',
    }, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
