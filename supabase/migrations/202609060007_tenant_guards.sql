begin;

-- Keep update paths tenant-scoped even though the functions are SECURITY DEFINER.
create or replace function public.rpc_upsert_enrollment(
  p_enrollment_id uuid,
  p_student_id uuid,
  p_class_id uuid,
  p_enrolled_from date,
  p_enrolled_to date default null,
  p_status text default 'ACTIVE',
  p_trace_id text default null
)
returns public.enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.enrollments;
  existing_row public.enrollments;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('ACTIVE', 'LEFT') or p_enrolled_from is null or (p_status = 'LEFT' and p_enrolled_to is null) then raise exception 'VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.students where id = p_student_id and center_id = public.current_center_id()) then raise exception 'STUDENT_NOT_FOUND'; end if;
  if not exists (select 1 from public.classes where id = p_class_id and center_id = public.current_center_id()) then raise exception 'CLASS_NOT_FOUND'; end if;
  if p_enrollment_id is not null then
    select e.* into existing_row
    from public.enrollments e
    join public.students s on s.id = e.student_id and s.center_id = public.current_center_id()
    join public.classes c on c.id = e.class_id and c.center_id = public.current_center_id()
    where e.id = p_enrollment_id
    for update;
    if existing_row.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
    if existing_row.student_id <> p_student_id or (existing_row.status = 'ACTIVE' and existing_row.class_id <> p_class_id) then raise exception 'ENROLLMENT_MOVE_CREATE_NEW'; end if;
    update public.enrollments
    set enrolled_from = p_enrolled_from, enrolled_to = p_enrolled_to, status = p_status
    where id = p_enrollment_id
    returning * into result_row;
  else
    insert into public.enrollments(student_id, class_id, enrolled_from, enrolled_to, status)
    values (p_student_id, p_class_id, p_enrolled_from, p_enrolled_to, p_status)
    returning * into result_row;
  end if;
  perform public.write_audit(case when p_enrollment_id is null then 'ENROLLMENT_CREATED' else 'ENROLLMENT_UPDATED' end, 'enrollments', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_upsert_assignment(
  p_assignment_id uuid,
  p_class_id uuid,
  p_staff_id uuid,
  p_role public.assignment_role,
  p_start_date date,
  p_end_date date default null,
  p_active boolean default true,
  p_trace_id text default null
)
returns public.class_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.class_assignments;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.classes where id = p_class_id and center_id = public.current_center_id()) then raise exception 'CLASS_NOT_FOUND'; end if;
  if not exists (select 1 from public.staff where id = p_staff_id and center_id = public.current_center_id()) then raise exception 'STAFF_NOT_FOUND'; end if;
  if p_assignment_id is null then
    insert into public.class_assignments(class_id, staff_id, role, start_date, end_date, active)
    values (p_class_id, p_staff_id, p_role, coalesce(p_start_date, current_date), p_end_date, p_active)
    returning * into result_row;
  else
    update public.class_assignments a
    set class_id = p_class_id, staff_id = p_staff_id, role = p_role, start_date = p_start_date, end_date = p_end_date, active = p_active
    where a.id = p_assignment_id
      and exists (select 1 from public.classes c where c.id = a.class_id and c.center_id = public.current_center_id())
    returning a.* into result_row;
    if result_row.id is null then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  end if;
  perform public.write_audit(case when p_assignment_id is null then 'ASSIGNMENT_CREATED' else 'ASSIGNMENT_UPDATED' end, 'class_assignments', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_upsert_schedule(
  p_schedule_id uuid,
  p_class_id uuid,
  p_weekday smallint,
  p_start_time time default null,
  p_end_time time default null,
  p_active boolean default true,
  p_trace_id text default null
)
returns public.class_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.class_schedules;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_weekday not between 1 and 7 or (p_end_time is not null and p_start_time is not null and p_end_time <= p_start_time) then raise exception 'VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.classes where id = p_class_id and center_id = public.current_center_id()) then raise exception 'CLASS_NOT_FOUND'; end if;
  if p_schedule_id is null then
    insert into public.class_schedules(class_id, weekday, start_time, end_time, active)
    values (p_class_id, p_weekday, p_start_time, p_end_time, p_active)
    returning * into result_row;
  else
    update public.class_schedules s
    set class_id = p_class_id, weekday = p_weekday, start_time = p_start_time, end_time = p_end_time, active = p_active
    where s.id = p_schedule_id
      and exists (select 1 from public.classes c where c.id = s.class_id and c.center_id = public.current_center_id())
    returning s.* into result_row;
    if result_row.id is null then raise exception 'SCHEDULE_NOT_FOUND'; end if;
  end if;
  perform public.write_audit(case when p_schedule_id is null then 'SCHEDULE_CREATED' else 'SCHEDULE_UPDATED' end, 'class_schedules', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

commit;
