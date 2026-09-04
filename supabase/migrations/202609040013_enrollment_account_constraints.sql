begin;

create unique index if not exists profiles_staff_id_uq
  on public.profiles(staff_id)
  where staff_id is not null;

create or replace function public.rpc_update_enrollment_status(
  p_enrollment_id uuid,
  p_status text,
  p_enrolled_to date default null,
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
  v_enrolled_to date;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_status not in ('ACTIVE', 'LEFT') then raise exception using message = 'VALIDATION_ERROR'; end if;
  select e.*, s.code as student_code, s.full_name as student_name, c.code as class_code
  into v_before
  from public.enrollments e
  join public.students s on s.id = e.student_id
  join public.classes c on c.id = e.class_id
  where e.id = p_enrollment_id and c.center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'ENROLLMENT_NOT_FOUND'; end if;
  if p_status = 'ACTIVE' and v_before.status = 'LEFT' then
    raise exception using message = 'ENROLLMENT_REJOIN_REQUIRED';
  end if;
  if p_status = 'LEFT' then
    if p_enrolled_to is null or p_enrolled_to < v_before.enrolled_from then raise exception using message = 'VALIDATION_ERROR'; end if;
    v_enrolled_to := p_enrolled_to;
  else
    v_enrolled_to := null;
  end if;
  update public.enrollments
  set status = p_status, enrolled_to = v_enrolled_to, updated_at = now()
  where id = p_enrollment_id;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'ENROLLMENT_STATUS_UPDATED', 'enrollment', p_enrollment_id::text,
    jsonb_build_object('student_code', v_before.student_code, 'class_code', v_before.class_code, 'status', v_before.status, 'enrolled_to', v_before.enrolled_to),
    jsonb_build_object('student_code', v_before.student_code, 'class_code', v_before.class_code, 'status', p_status, 'enrolled_to', v_enrolled_to), p_trace_id
  );
  return jsonb_build_object('enrollment_id', p_enrollment_id, 'status', p_status, 'enrolled_to', v_enrolled_to);
end;
$$;

grant execute on function public.rpc_update_enrollment_status(uuid, text, date, text) to authenticated;

commit;
