begin;

alter table public.staff add column if not exists email text;

create unique index if not exists staff_center_email_lower_uq
  on public.staff(center_id, lower(email))
  where email is not null;

create index if not exists profiles_staff_id_idx on public.profiles(staff_id);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or (public.is_accountant() and center_id = public.current_center_id()));

create or replace function public.rpc_update_class(
  p_class_id uuid,
  p_code text,
  p_name text,
  p_grade int,
  p_subject text,
  p_standard_unit_fee bigint,
  p_collection_method public.collection_method,
  p_status public.entity_status,
  p_note text default null,
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
  if coalesce(trim(p_code), '') = '' or coalesce(trim(p_name), '') = ''
     or coalesce(trim(p_subject), '') = '' or p_grade not between 1 and 12
     or p_standard_unit_fee is null or p_standard_unit_fee < 0
     or p_collection_method is null or p_status is null then
    raise exception using message = 'VALIDATION_ERROR';
  end if;
  select * into v_before
  from public.classes
  where id = p_class_id and center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'CLASS_NOT_FOUND'; end if;
  if exists (
    select 1 from public.classes
    where center_id = public.current_center_id()
      and lower(code) = lower(trim(p_code))
      and id <> p_class_id
  ) then
    raise exception using message = 'CONFLICT';
  end if;
  update public.classes
  set code = trim(p_code), name = trim(p_name), grade = p_grade,
      subject = trim(p_subject), standard_unit_fee = p_standard_unit_fee,
      collection_method = p_collection_method, status = p_status,
      note = nullif(trim(p_note), ''), updated_at = now()
  where id = p_class_id;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'CLASS_UPDATED', 'class', p_class_id::text,
    jsonb_build_object(
      'code', v_before.code, 'name', v_before.name, 'grade', v_before.grade,
      'subject', v_before.subject, 'standard_unit_fee', v_before.standard_unit_fee,
      'collection_method', v_before.collection_method, 'status', v_before.status,
      'note', v_before.note
    ),
    jsonb_build_object(
      'code', trim(p_code), 'name', trim(p_name), 'grade', p_grade,
      'subject', trim(p_subject), 'standard_unit_fee', p_standard_unit_fee,
      'collection_method', p_collection_method, 'status', p_status,
      'note', nullif(trim(p_note), '')
    ),
    p_trace_id
  );
  return jsonb_build_object('class_id', p_class_id);
end;
$$;

create or replace function public.rpc_update_staff(
  p_staff_id uuid,
  p_code text,
  p_full_name text,
  p_staff_type public.staff_type,
  p_phone text default null,
  p_primary_subject text default null,
  p_status public.entity_status default 'ACTIVE',
  p_note text default null,
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
  if coalesce(trim(p_code), '') = '' or coalesce(trim(p_full_name), '') = ''
     or p_staff_type is null or p_status is null then
    raise exception using message = 'VALIDATION_ERROR';
  end if;
  select * into v_before
  from public.staff
  where id = p_staff_id and center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'STAFF_NOT_FOUND'; end if;
  if exists (
    select 1 from public.staff
    where center_id = public.current_center_id()
      and lower(code) = lower(trim(p_code))
      and id <> p_staff_id
  ) then
    raise exception using message = 'CONFLICT';
  end if;
  update public.staff
  set code = trim(p_code), full_name = trim(p_full_name), staff_type = p_staff_type,
      phone = nullif(trim(p_phone), ''), primary_subject = nullif(trim(p_primary_subject), ''),
      status = p_status, note = nullif(trim(p_note), ''), updated_at = now()
  where id = p_staff_id;
  if p_status = 'INACTIVE' then
    update public.profiles
    set active = false, updated_at = now()
    where staff_id = p_staff_id
      and center_id = public.current_center_id()
      and active = true;
  end if;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'STAFF_UPDATED', 'staff', p_staff_id::text,
    jsonb_build_object(
      'code', v_before.code, 'full_name', v_before.full_name,
      'staff_type', v_before.staff_type, 'phone', v_before.phone,
      'primary_subject', v_before.primary_subject, 'status', v_before.status,
      'note', v_before.note
    ),
    jsonb_build_object(
      'code', trim(p_code), 'full_name', trim(p_full_name),
      'staff_type', p_staff_type, 'phone', nullif(trim(p_phone), ''),
      'primary_subject', nullif(trim(p_primary_subject), ''), 'status', p_status,
      'note', nullif(trim(p_note), '')
    ),
    p_trace_id
  );
  return jsonb_build_object('staff_id', p_staff_id);
end;
$$;

create or replace function public.rpc_update_student(
  p_student_id uuid,
  p_code text,
  p_full_name text,
  p_phone text default null,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_status public.entity_status default 'ACTIVE',
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before record;
  v_enrollment record;
  v_user uuid := auth.uid();
  v_enrolled_to date;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if coalesce(trim(p_code), '') = '' or coalesce(trim(p_full_name), '') = '' or p_status is null then
    raise exception using message = 'VALIDATION_ERROR';
  end if;
  select * into v_before from public.students where id = p_student_id and center_id = public.current_center_id() for update;
  if not found then raise exception using message = 'STUDENT_NOT_FOUND'; end if;
  if exists (select 1 from public.students where center_id = public.current_center_id() and lower(code) = lower(trim(p_code)) and id <> p_student_id) then
    raise exception using message = 'CONFLICT';
  end if;
  update public.students
  set code = trim(p_code), full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''),
      parent_name = nullif(trim(p_parent_name), ''), parent_phone = nullif(trim(p_parent_phone), ''),
      status = p_status, note = nullif(trim(p_note), ''), updated_at = now()
  where id = p_student_id;
  if p_status = 'INACTIVE' then
    for v_enrollment in
      select e.id, e.class_id, e.status, e.enrolled_to, c.code as class_code
      from public.enrollments e join public.classes c on c.id = e.class_id
      where e.student_id = p_student_id and e.status = 'ACTIVE' and c.center_id = public.current_center_id()
      for update
    loop
      v_enrolled_to := coalesce(v_enrollment.enrolled_to, current_date);
      update public.enrollments set status = 'LEFT', enrolled_to = v_enrolled_to, updated_at = now() where id = v_enrollment.id;
      insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
      values (
        public.current_center_id(), v_user, 'ENROLLMENT_STATUS_UPDATED', 'enrollment', v_enrollment.id::text,
        jsonb_build_object('status', v_enrollment.status, 'enrolled_to', v_enrollment.enrolled_to, 'source', 'STUDENT_INACTIVE'),
        jsonb_build_object('status', 'LEFT', 'enrolled_to', v_enrolled_to, 'class_code', v_enrollment.class_code, 'source', 'STUDENT_INACTIVE'), p_trace_id
      );
    end loop;
  end if;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'STUDENT_UPDATED', 'student', p_student_id::text,
    jsonb_build_object('code', v_before.code, 'full_name', v_before.full_name, 'status', v_before.status),
    jsonb_build_object('code', trim(p_code), 'full_name', trim(p_full_name), 'status', p_status), p_trace_id
  );
  return jsonb_build_object('student_id', p_student_id);
end;
$$;

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
    if p_enrolled_to is null then raise exception using message = 'VALIDATION_ERROR'; end if;
    v_enrolled_to := p_enrolled_to;
    if v_enrolled_to < v_before.enrolled_from then raise exception using message = 'VALIDATION_ERROR'; end if;
  else
    v_enrolled_to := null;
  end if;
  update public.enrollments
  set status = p_status, enrolled_to = v_enrolled_to, updated_at = now()
  where id = p_enrollment_id;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'ENROLLMENT_STATUS_UPDATED', 'enrollment', p_enrollment_id::text,
    jsonb_build_object(
      'student_code', v_before.student_code, 'class_code', v_before.class_code,
      'status', v_before.status, 'enrolled_to', v_before.enrolled_to
    ),
    jsonb_build_object(
      'student_code', v_before.student_code, 'class_code', v_before.class_code,
      'status', p_status, 'enrolled_to', v_enrolled_to
    ),
    p_trace_id
  );
  return jsonb_build_object('enrollment_id', p_enrollment_id, 'status', p_status, 'enrolled_to', v_enrolled_to);
end;
$$;

create or replace function public.rpc_link_staff_account(
  p_staff_id uuid,
  p_user_id uuid,
  p_email text,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
  v_role public.app_role;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_user_id is null or coalesce(trim(p_email), '') = ''
     or lower(trim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception using message = 'EMAIL_INVALID';
  end if;
  select * into v_staff
  from public.staff
  where id = p_staff_id and center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'STAFF_NOT_FOUND'; end if;
  if v_staff.status <> 'ACTIVE' then raise exception using message = 'STAFF_INACTIVE'; end if;
  if exists (select 1 from public.profiles where staff_id = p_staff_id)
     or exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception using message = 'STAFF_ACCOUNT_EXISTS';
  end if;
  if exists (
    select 1 from public.staff
    where center_id = public.current_center_id()
      and email is not null and lower(email) = lower(trim(p_email))
      and id <> p_staff_id
  ) then
    raise exception using message = 'CONFLICT';
  end if;
  v_role := case when v_staff.staff_type = 'ASSISTANT' then 'ASSISTANT'::public.app_role else 'TEACHER'::public.app_role end;
  update public.staff set email = lower(trim(p_email)), updated_at = now() where id = p_staff_id;
  insert into public.profiles(user_id, center_id, full_name, role, staff_id, active)
  values (p_user_id, public.current_center_id(), v_staff.full_name, v_role, p_staff_id, true);
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (
    public.current_center_id(), v_user, 'STAFF_ACCOUNT_LINKED', 'staff', p_staff_id::text,
    jsonb_build_object('user_id', p_user_id, 'email', lower(trim(p_email)), 'role', v_role), p_trace_id
  );
  return jsonb_build_object('staff_id', p_staff_id, 'user_id', p_user_id, 'email', lower(trim(p_email)), 'role', v_role);
end;
$$;

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
  select id, center_id, code, full_name into v_student
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

grant execute on function public.rpc_update_enrollment_status(uuid, text, date, text) to authenticated;
grant execute on function public.rpc_link_staff_account(uuid, uuid, text, text) to authenticated;
grant execute on function public.rpc_create_enrollment(uuid, uuid, date, bigint, text, text) to authenticated;

commit;
