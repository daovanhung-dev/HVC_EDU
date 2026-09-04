begin;

create or replace function public.rpc_create_enrollment(
  p_student_id uuid,
  p_class_id uuid,
  p_enrolled_from date,
  p_unit_price_override bigint default null,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_class record;
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_enrolled_from is null or p_unit_price_override is not null and p_unit_price_override < 0 then
    raise exception using message = 'VALIDATION_ERROR';
  end if;
  select id, center_id, code, full_name, status into v_student
  from public.students where id = p_student_id and center_id = public.current_center_id() for update;
  if not found then raise exception using message = 'STUDENT_NOT_FOUND'; end if;
  if v_student.status <> 'ACTIVE' then raise exception using message = 'STUDENT_INACTIVE'; end if;
  select id, center_id, code, name into v_class
  from public.classes where id = p_class_id and center_id = public.current_center_id() for update;
  if not found then raise exception using message = 'CLASS_NOT_FOUND'; end if;
  if exists (select 1 from public.enrollments where student_id = p_student_id and class_id = p_class_id and status = 'ACTIVE') then
    raise exception using message = 'CONFLICT';
  end if;
  if exists (select 1 from public.enrollments where student_id = p_student_id and class_id = p_class_id and status = 'LEFT' and enrolled_to is not null and p_enrolled_from <= enrolled_to) then
    raise exception using message = 'VALIDATION_ERROR';
  end if;
  insert into public.enrollments(student_id, class_id, enrolled_from, status, unit_price_override, note)
  values (p_student_id, p_class_id, p_enrolled_from, 'ACTIVE', p_unit_price_override, nullif(trim(p_note), ''))
  returning id into v_id;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'ENROLLMENT_CREATED', 'enrollment', v_id::text,
    jsonb_build_object('student_code', v_student.code, 'class_code', v_class.code, 'enrolled_from', p_enrolled_from, 'status', 'ACTIVE'), p_trace_id
  );
  return jsonb_build_object('enrollment_id', v_id);
end;
$$;

grant execute on function public.rpc_create_enrollment(uuid, uuid, date, bigint, text, text) to authenticated;

commit;
