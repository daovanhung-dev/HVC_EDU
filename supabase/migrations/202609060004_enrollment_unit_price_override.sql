begin;

create or replace function public.rpc_update_enrollment_unit_price(
  p_enrollment_id uuid,
  p_unit_price_override bigint,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before record;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_unit_price_override is not null and p_unit_price_override < 0 then
    raise exception using message = 'VALIDATION_ERROR';
  end if;

  select e.*, s.code as student_code, s.full_name as student_name, c.code as class_code
  into v_before
  from public.enrollments e
  join public.students s on s.id = e.student_id and s.center_id = public.current_center_id()
  join public.classes c on c.id = e.class_id and c.center_id = public.current_center_id()
  where e.id = p_enrollment_id
  for update;
  if not found then raise exception using message = 'ENROLLMENT_NOT_FOUND'; end if;
  if v_before.status <> 'ACTIVE' then
    raise exception using message = 'ENROLLMENT_NOT_ACTIVE';
  end if;

  update public.enrollments
  set unit_price_override = p_unit_price_override, updated_at = now()
  where id = p_enrollment_id;

  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'ENROLLMENT_UNIT_PRICE_UPDATED', 'enrollment', p_enrollment_id::text,
    jsonb_build_object(
      'student_code', v_before.student_code,
      'student_name', v_before.student_name,
      'class_code', v_before.class_code,
      'unit_price_override', v_before.unit_price_override
    ),
    jsonb_build_object(
      'student_code', v_before.student_code,
      'student_name', v_before.student_name,
      'class_code', v_before.class_code,
      'unit_price_override', p_unit_price_override
    ),
    p_trace_id
  );

  return jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'unit_price_override', p_unit_price_override
  );
end;
$$;

revoke all on function public.rpc_update_enrollment_unit_price(uuid, bigint, text) from public;
grant execute on function public.rpc_update_enrollment_unit_price(uuid, bigint, text) to authenticated;

commit;
