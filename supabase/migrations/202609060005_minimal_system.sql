begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create temporary table _minimal_admin_profiles on commit drop as
select p.user_id, p.center_id, p.full_name, p.active
from public.profiles p
join auth.users u on u.id = p.user_id
where p.role::text = 'ADMIN';

create temporary table _minimal_hc_centers on commit drop as
select c.id, c.code, c.name, c.status::text as status, c.created_at, c.updated_at
from public.centers c
where c.code = 'HC';

do $$
begin
  if not exists (select 1 from _minimal_hc_centers) then
    raise exception using message = 'MINIMAL_RESET_ABORTED_CENTER_HC_NOT_FOUND';
  end if;
  if not exists (select 1 from _minimal_admin_profiles) then
    raise exception using message = 'MINIMAL_RESET_ABORTED_NO_ADMIN_PROFILE';
  end if;
end;
$$;

drop view if exists public.v_class_period_summary cascade;
drop view if exists public.v_student_attendance_summary cascade;
drop view if exists public.v_student_evaluation_summary cascade;
drop view if exists public.v_tuition_period_summary cascade;
drop view if exists public.v_finance_period_summary cascade;

do $$
declare
  item record;
begin
  for item in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('drop function if exists public.%I(%s) cascade', item.proname, item.arguments);
  end loop;
end;
$$;

drop table if exists public.notifications cascade;
drop table if exists public.staff_availability cascade;
drop table if exists public.staff_work_attendance cascade;
drop table if exists public.period_settings cascade;
drop table if exists public.period_class_configs cascade;
drop table if exists public.idempotency_requests cascade;
drop table if exists public.import_job_issues cascade;
drop table if exists public.import_jobs cascade;
drop table if exists public.profit_distributions cascade;
drop table if exists public.fund_ledger cascade;
drop table if exists public.payroll_items cascade;
drop table if exists public.payroll_runs cascade;
drop table if exists public.payroll_policies cascade;
drop table if exists public.student_rewards cascade;
drop table if exists public.payments cascade;
drop table if exists public.tuition_adjustments cascade;
drop table if exists public.tuition_ledgers cascade;
drop table if exists public.financial_transactions cascade;
drop table if exists public.student_session_evaluations cascade;
drop table if exists public.attendance cascade;
drop table if exists public.class_sessions cascade;
drop table if exists public.class_assignments cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.students cascade;
drop table if exists public.class_schedules cascade;
drop table if exists public.classes cascade;
drop table if exists public.accounting_periods cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.profiles cascade;
drop table if exists public.staff cascade;
drop table if exists public.centers cascade;

drop type if exists public.app_role cascade;
drop type if exists public.entity_status cascade;
drop type if exists public.staff_type cascade;
drop type if exists public.assignment_role cascade;
drop type if exists public.session_status cascade;
drop type if exists public.attendance_status cascade;
drop type if exists public.staff_attendance_status cascade;
drop type if exists public.financial_transaction_type cascade;

create extension if not exists pgcrypto;

create type public.app_role as enum ('ADMIN', 'STAFF');
create type public.entity_status as enum ('ACTIVE', 'INACTIVE');
create type public.staff_type as enum ('TEACHER', 'ASSISTANT');
create type public.assignment_role as enum ('TEACHER', 'ASSISTANT');
create type public.session_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');
create type public.attendance_status as enum ('PRESENT', 'ABSENT', 'EXCUSED');
create type public.staff_attendance_status as enum ('PRESENT', 'ABSENT', 'LEAVE');
create type public.financial_transaction_type as enum ('INCOME', 'EXPENSE');

create table public.centers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.centers (id, code, name, status, created_at, updated_at)
select hc.id, hc.code, hc.name, hc.status::text::public.entity_status, hc.created_at, hc.updated_at
from _minimal_hc_centers hc;

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  code text not null,
  full_name text not null,
  staff_type public.staff_type not null default 'TEACHER',
  phone text,
  email text,
  note text,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, code),
  unique (center_id, email)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  center_id uuid not null references public.centers(id) on delete restrict,
  full_name text not null,
  role public.app_role not null default 'STAFF',
  staff_id uuid references public.staff(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id)
);

insert into public.profiles (user_id, center_id, full_name, role, active)
select user_id, center_id, full_name, 'ADMIN'::public.app_role, active
from _minimal_admin_profiles;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  code text not null,
  name text not null,
  grade smallint not null check (grade between 1 and 12),
  subject text not null,
  note text,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, code)
);

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time,
  end_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time),
  unique (class_id, weekday, start_time)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  code text not null,
  full_name text not null,
  phone text,
  parent_name text,
  parent_phone text,
  note text,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (center_id, code)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  enrolled_from date not null,
  enrolled_to date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'LEFT')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (enrolled_to is null or enrolled_to >= enrolled_from)
);

create unique index enrollments_one_active_student
  on public.enrollments(student_id) where status = 'ACTIVE';

create table public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  role public.assignment_role not null,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (class_id, staff_id, role, start_date)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  session_date date not null,
  start_time time,
  end_time time,
  status public.session_status not null default 'SCHEDULED',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index class_sessions_unique_slot
  on public.class_sessions(class_id, session_date, coalesce(start_time, time '00:00'));

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  status public.attendance_status not null,
  note text,
  marked_by uuid not null references auth.users(id),
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, enrollment_id)
);

create table public.student_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  comment text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, enrollment_id)
);

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  attendance_date date not null,
  status public.staff_attendance_status not null,
  note text,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, attendance_date)
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  transaction_date date not null,
  type public.financial_transaction_type not null,
  category text not null,
  description text not null,
  amount bigint not null check (amount > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  center_id uuid references public.centers(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  trace_id text,
  created_at timestamptz not null default now()
);

create index class_schedules_class_idx on public.class_schedules(class_id, active);
create index enrollments_class_idx on public.enrollments(class_id, status);
create index assignments_staff_idx on public.class_assignments(staff_id, active);
create index sessions_date_idx on public.class_sessions(session_date, class_id);
create index staff_attendance_date_idx on public.staff_attendance(attendance_date, staff_id);
create index financial_transactions_date_idx on public.financial_transactions(center_id, transaction_date);
create index audit_logs_created_idx on public.audit_logs(center_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'centers', 'staff', 'profiles', 'classes', 'class_schedules', 'students',
    'enrollments', 'class_assignments', 'class_sessions', 'attendance',
    'student_evaluations', 'staff_attendance', 'financial_transactions'
  ] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.current_center_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select center_id from public.profiles where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select staff_id from public.profiles where user_id = auth.uid() and active limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'ADMIN'::public.app_role;
$$;

create or replace function public.has_class_assignment(p_class_id uuid, p_on_date date default current_date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.class_assignments a
    where a.class_id = p_class_id
      and a.staff_id = public.current_staff_id()
      and a.active
      and a.start_date <= p_on_date
      and (a.end_date is null or a.end_date >= p_on_date)
  );
$$;

create or replace function public.write_audit(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_trace_id text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (public.current_center_id(), auth.uid(), p_action, p_resource_type, p_resource_id, p_before, p_after, p_trace_id);
$$;

create or replace function public.rpc_upsert_staff(
  p_staff_id uuid,
  p_code text,
  p_full_name text,
  p_staff_type public.staff_type,
  p_phone text default null,
  p_email text default null,
  p_note text default null,
  p_status public.entity_status default 'ACTIVE',
  p_trace_id text default null
)
returns public.staff
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.staff;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_full_name), '') is null then raise exception 'VALIDATION_ERROR'; end if;
  if p_staff_id is null then
    insert into public.staff(center_id, code, full_name, staff_type, phone, email, note, status)
    values (public.current_center_id(), trim(p_code), trim(p_full_name), p_staff_type, nullif(trim(p_phone), ''), nullif(lower(trim(p_email)), ''), nullif(trim(p_note), ''), p_status)
    returning * into result_row;
  else
    update public.staff
    set code = trim(p_code), full_name = trim(p_full_name), staff_type = p_staff_type,
        phone = nullif(trim(p_phone), ''), email = nullif(lower(trim(p_email)), ''),
        note = nullif(trim(p_note), ''), status = p_status
    where id = p_staff_id and center_id = public.current_center_id()
    returning * into result_row;
    if result_row.id is null then raise exception 'STAFF_NOT_FOUND'; end if;
  end if;
  perform public.write_audit(case when p_staff_id is null then 'STAFF_CREATED' else 'STAFF_UPDATED' end, 'staff', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_upsert_class(
  p_class_id uuid,
  p_code text,
  p_name text,
  p_grade smallint,
  p_subject text,
  p_note text default null,
  p_status public.entity_status default 'ACTIVE',
  p_trace_id text default null
)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.classes;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_name), '') is null or nullif(trim(p_subject), '') is null or p_grade not between 1 and 12 then raise exception 'VALIDATION_ERROR'; end if;
  if p_class_id is null then
    insert into public.classes(center_id, code, name, grade, subject, note, status)
    values (public.current_center_id(), trim(p_code), trim(p_name), p_grade, trim(p_subject), nullif(trim(p_note), ''), p_status)
    returning * into result_row;
  else
    update public.classes
    set code = trim(p_code), name = trim(p_name), grade = p_grade, subject = trim(p_subject), note = nullif(trim(p_note), ''), status = p_status
    where id = p_class_id and center_id = public.current_center_id()
    returning * into result_row;
    if result_row.id is null then raise exception 'CLASS_NOT_FOUND'; end if;
  end if;
  perform public.write_audit(case when p_class_id is null then 'CLASS_CREATED' else 'CLASS_UPDATED' end, 'classes', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_upsert_student(
  p_student_id uuid,
  p_code text,
  p_full_name text,
  p_phone text default null,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_note text default null,
  p_status public.entity_status default 'ACTIVE',
  p_trace_id text default null
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.students;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if nullif(trim(p_code), '') is null or nullif(trim(p_full_name), '') is null then raise exception 'VALIDATION_ERROR'; end if;
  if p_student_id is null then
    insert into public.students(center_id, code, full_name, phone, parent_name, parent_phone, note, status)
    values (public.current_center_id(), trim(p_code), trim(p_full_name), nullif(trim(p_phone), ''), nullif(trim(p_parent_name), ''), nullif(trim(p_parent_phone), ''), nullif(trim(p_note), ''), p_status)
    returning * into result_row;
  else
    update public.students
    set code = trim(p_code), full_name = trim(p_full_name), phone = nullif(trim(p_phone), ''),
        parent_name = nullif(trim(p_parent_name), ''), parent_phone = nullif(trim(p_parent_phone), ''),
        note = nullif(trim(p_note), ''), status = p_status
    where id = p_student_id and center_id = public.current_center_id()
    returning * into result_row;
    if result_row.id is null then raise exception 'STUDENT_NOT_FOUND'; end if;
  end if;
  perform public.write_audit(case when p_student_id is null then 'STUDENT_CREATED' else 'STUDENT_UPDATED' end, 'students', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

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
    select * into existing_row from public.enrollments where id = p_enrollment_id for update;
    if existing_row.id is null then raise exception 'ENROLLMENT_NOT_FOUND'; end if;
    if existing_row.student_id <> p_student_id or (existing_row.status = 'ACTIVE' and existing_row.class_id <> p_class_id) then raise exception 'ENROLLMENT_MOVE_CREATE_NEW'; end if;
    update public.enrollments set enrolled_from = p_enrolled_from, enrolled_to = p_enrolled_to, status = p_status where id = p_enrollment_id returning * into result_row;
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
    update public.class_assignments set class_id = p_class_id, staff_id = p_staff_id, role = p_role, start_date = p_start_date, end_date = p_end_date, active = p_active where id = p_assignment_id returning * into result_row;
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
    update public.class_schedules set class_id = p_class_id, weekday = p_weekday, start_time = p_start_time, end_time = p_end_time, active = p_active where id = p_schedule_id returning * into result_row;
    if result_row.id is null then raise exception 'SCHEDULE_NOT_FOUND'; end if;
  end if;
  perform public.write_audit(case when p_schedule_id is null then 'SCHEDULE_CREATED' else 'SCHEDULE_UPDATED' end, 'class_schedules', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_deactivate_entity(
  p_entity text,
  p_id uuid,
  p_trace_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  case p_entity
    when 'staff' then update public.staff set status = 'INACTIVE' where id = p_id and center_id = public.current_center_id() returning to_jsonb(staff) into result;
    when 'classes' then update public.classes set status = 'INACTIVE' where id = p_id and center_id = public.current_center_id() returning to_jsonb(classes) into result;
    when 'students' then update public.students set status = 'INACTIVE' where id = p_id and center_id = public.current_center_id() returning to_jsonb(students) into result;
    else raise exception 'VALIDATION_ERROR';
  end case;
  if result is null then raise exception 'NOT_FOUND'; end if;
  perform public.write_audit('ENTITY_DEACTIVATED', p_entity, p_id, null, result, p_trace_id);
  return jsonb_build_object('entity', p_entity, 'id', p_id, 'status', 'INACTIVE');
end;
$$;

create or replace function public.rpc_generate_sessions(
  p_from_date date,
  p_to_date date,
  p_trace_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_from_date is null or p_to_date is null or p_to_date < p_from_date or p_to_date - p_from_date > 366 then raise exception 'VALIDATION_ERROR'; end if;
  insert into public.class_sessions(class_id, session_date, start_time, end_time)
  select s.class_id, days.session_date::date, s.start_time, s.end_time
  from public.class_schedules s
  join public.classes c on c.id = s.class_id and c.center_id = public.current_center_id() and c.status = 'ACTIVE'
  cross join lateral generate_series(p_from_date, p_to_date, interval '1 day') days(session_date)
  where s.active and extract(isodow from days.session_date) = s.weekday
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  perform public.write_audit('SESSIONS_GENERATED', 'class_sessions', null, null, jsonb_build_object('from_date', p_from_date, 'to_date', p_to_date, 'inserted', inserted_count), p_trace_id);
  return jsonb_build_object('inserted', inserted_count, 'from_date', p_from_date, 'to_date', p_to_date);
end;
$$;

create or replace function public.rpc_upsert_attendance(
  p_session_id uuid,
  p_items jsonb,
  p_trace_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.class_sessions;
  item record;
  saved_count integer := 0;
begin
  select * into session_row from public.class_sessions where id = p_session_id;
  if session_row.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if not (public.is_admin() or public.has_class_assignment(session_row.class_id, session_row.session_date)) then raise exception 'CLASS_NOT_ASSIGNED'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'VALIDATION_ERROR'; end if;
  for item in select * from jsonb_to_recordset(p_items) as x(enrollment_id uuid, status text, note text)
  loop
    if item.status not in ('PRESENT', 'ABSENT', 'EXCUSED') then raise exception 'VALIDATION_ERROR'; end if;
    if not exists (
      select 1 from public.enrollments e
      join public.students st on st.id = e.student_id and st.center_id = public.current_center_id()
      where e.id = item.enrollment_id and e.class_id = session_row.class_id and e.status = 'ACTIVE'
        and e.enrolled_from <= session_row.session_date and (e.enrolled_to is null or e.enrolled_to >= session_row.session_date)
    ) then raise exception 'ENROLLMENT_NOT_ACTIVE'; end if;
    insert into public.attendance(session_id, enrollment_id, status, note, marked_by)
    values (p_session_id, item.enrollment_id, item.status::public.attendance_status, nullif(trim(item.note), ''), auth.uid())
    on conflict (session_id, enrollment_id) do update set status = excluded.status, note = excluded.note, marked_by = auth.uid(), updated_at = now();
    saved_count := saved_count + 1;
  end loop;
  update public.class_sessions set status = 'COMPLETED' where id = p_session_id and status = 'SCHEDULED';
  perform public.write_audit('ATTENDANCE_SAVED', 'class_sessions', p_session_id, null, jsonb_build_object('count', saved_count), p_trace_id);
  return jsonb_build_object('saved', saved_count);
end;
$$;

create or replace function public.rpc_upsert_evaluations(
  p_session_id uuid,
  p_items jsonb,
  p_trace_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.class_sessions;
  item record;
  saved_count integer := 0;
begin
  select * into session_row from public.class_sessions where id = p_session_id;
  if session_row.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if not public.has_class_assignment(session_row.class_id, session_row.session_date) then raise exception 'CLASS_NOT_ASSIGNED'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'VALIDATION_ERROR'; end if;
  for item in select * from jsonb_to_recordset(p_items) as x(enrollment_id uuid, comment text)
  loop
    if not exists (
      select 1 from public.enrollments e
      join public.students st on st.id = e.student_id and st.center_id = public.current_center_id()
      where e.id = item.enrollment_id and e.class_id = session_row.class_id and e.status = 'ACTIVE'
        and e.enrolled_from <= session_row.session_date and (e.enrolled_to is null or e.enrolled_to >= session_row.session_date)
    ) then raise exception 'ENROLLMENT_NOT_ACTIVE'; end if;
    insert into public.student_evaluations(session_id, enrollment_id, comment, created_by)
    values (p_session_id, item.enrollment_id, nullif(trim(item.comment), ''), auth.uid())
    on conflict (session_id, enrollment_id) do update set comment = excluded.comment, created_by = auth.uid(), updated_at = now();
    saved_count := saved_count + 1;
  end loop;
  perform public.write_audit('EVALUATIONS_SAVED', 'class_sessions', p_session_id, null, jsonb_build_object('count', saved_count), p_trace_id);
  return jsonb_build_object('saved', saved_count);
end;
$$;

create or replace function public.rpc_upsert_staff_attendance(
  p_staff_id uuid,
  p_attendance_date date,
  p_status public.staff_attendance_status,
  p_note text default null,
  p_trace_id text default null
)
returns public.staff_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.staff_attendance;
  target_staff uuid := case when public.is_admin() and p_staff_id is not null then p_staff_id else public.current_staff_id() end;
begin
  if target_staff is null then raise exception 'STAFF_NOT_FOUND'; end if;
  if not public.is_admin() and target_staff <> public.current_staff_id() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.staff where id = target_staff and center_id = public.current_center_id() and status = 'ACTIVE') then raise exception 'STAFF_NOT_FOUND'; end if;
  insert into public.staff_attendance(staff_id, attendance_date, status, note, recorded_by)
  values (target_staff, p_attendance_date, p_status, nullif(trim(p_note), ''), auth.uid())
  on conflict (staff_id, attendance_date) do update set status = excluded.status, note = excluded.note, recorded_by = auth.uid(), updated_at = now()
  returning * into result_row;
  perform public.write_audit('STAFF_ATTENDANCE_SAVED', 'staff_attendance', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_record_financial_transaction(
  p_transaction_id uuid,
  p_transaction_date date,
  p_type public.financial_transaction_type,
  p_category text,
  p_description text,
  p_amount bigint,
  p_trace_id text default null
)
returns public.financial_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.financial_transactions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_transaction_date is null or nullif(trim(p_category), '') is null or nullif(trim(p_description), '') is null or p_amount is null or p_amount <= 0 then raise exception 'VALIDATION_ERROR'; end if;
  if p_transaction_id is null then
    insert into public.financial_transactions(center_id, transaction_date, type, category, description, amount, created_by)
    values (public.current_center_id(), p_transaction_date, p_type, trim(p_category), trim(p_description), p_amount, auth.uid())
    returning * into result_row;
  else
    update public.financial_transactions set transaction_date = p_transaction_date, type = p_type, category = trim(p_category), description = trim(p_description), amount = p_amount
    where id = p_transaction_id and center_id = public.current_center_id()
    returning * into result_row;
    if result_row.id is null then raise exception 'NOT_FOUND'; end if;
  end if;
  perform public.write_audit(case when p_transaction_id is null then 'TRANSACTION_CREATED' else 'TRANSACTION_UPDATED' end, 'financial_transactions', result_row.id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_link_staff_account(
  p_staff_id uuid,
  p_user_id uuid,
  p_trace_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.profiles;
  staff_row public.staff;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into staff_row from public.staff where id = p_staff_id and center_id = public.current_center_id();
  if staff_row.id is null then raise exception 'STAFF_NOT_FOUND'; end if;
  insert into public.profiles(user_id, center_id, full_name, role, staff_id, active)
  values (p_user_id, staff_row.center_id, staff_row.full_name, 'STAFF', staff_row.id, true)
  on conflict (user_id) do update set center_id = excluded.center_id, full_name = excluded.full_name, role = 'STAFF', staff_id = excluded.staff_id, active = true
  returning * into result_row;
  perform public.write_audit('STAFF_ACCOUNT_LINKED', 'profiles', result_row.user_id, null, to_jsonb(result_row), p_trace_id);
  return result_row;
end;
$$;

create or replace function public.rpc_dashboard_summary(p_from_date date, p_to_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with visible_classes as (
    select c.id from public.classes c where c.center_id = public.current_center_id() and c.status = 'ACTIVE' and public.has_class_assignment(c.id)
  ),
  visible_students as (
    select distinct st.id
    from public.students st join public.enrollments e on e.student_id = st.id and e.status = 'ACTIVE'
    where st.center_id = public.current_center_id() and (public.is_admin() or e.class_id in (select id from visible_classes))
  ),
  money as (
    select coalesce(sum(amount) filter (where type = 'INCOME'), 0)::bigint as income,
           coalesce(sum(amount) filter (where type = 'EXPENSE'), 0)::bigint as expense
    from public.financial_transactions
    where center_id = public.current_center_id() and public.is_admin()
      and transaction_date between coalesce(p_from_date, date_trunc('month', current_date)::date) and coalesce(p_to_date, current_date)
  )
  select jsonb_build_object(
    'from_date', coalesce(p_from_date, date_trunc('month', current_date)::date),
    'to_date', coalesce(p_to_date, current_date),
    'active_classes', (select count(*) from visible_classes),
    'active_students', (select count(*) from visible_students),
    'active_staff', (select count(*) from public.staff where center_id = public.current_center_id() and status = 'ACTIVE'),
    'sessions', (select count(*) from public.class_sessions s where s.session_date between coalesce(p_from_date, date_trunc('month', current_date)::date) and coalesce(p_to_date, current_date) and (public.is_admin() or public.has_class_assignment(s.class_id, s.session_date))),
    'income', (select income from money),
    'expense', (select expense from money),
    'balance', (select income - expense from money),
    'role', public.current_app_role()
  );
$$;

alter table public.centers enable row level security;
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.classes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_assignments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.student_evaluations enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.audit_logs enable row level security;

create policy centers_read on public.centers for select to authenticated using (id = public.current_center_id());
create policy profiles_read on public.profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy staff_read on public.staff for select to authenticated using (center_id = public.current_center_id() and (public.is_admin() or id = public.current_staff_id()));
create policy classes_read on public.classes for select to authenticated using (center_id = public.current_center_id() and (status = 'ACTIVE' or public.is_admin()) and public.has_class_assignment(id));
create policy schedules_read on public.class_schedules for select to authenticated using (public.has_class_assignment(class_id));
create policy students_read on public.students for select to authenticated using (center_id = public.current_center_id() and (public.is_admin() or exists (select 1 from public.enrollments e where e.student_id = students.id and e.status = 'ACTIVE' and public.has_class_assignment(e.class_id))));
create policy enrollments_read on public.enrollments for select to authenticated using (exists (select 1 from public.students st where st.id = enrollments.student_id and st.center_id = public.current_center_id()) and public.has_class_assignment(class_id));
create policy assignments_read on public.class_assignments for select to authenticated using (public.has_class_assignment(class_id));
create policy sessions_read on public.class_sessions for select to authenticated using (public.has_class_assignment(class_id, session_date));
create policy attendance_read on public.attendance for select to authenticated using (exists (select 1 from public.class_sessions s where s.id = attendance.session_id and public.has_class_assignment(s.class_id, s.session_date)));
create policy evaluations_read on public.student_evaluations for select to authenticated using (exists (select 1 from public.class_sessions s where s.id = student_evaluations.session_id and public.has_class_assignment(s.class_id, s.session_date)));
create policy staff_attendance_read on public.staff_attendance for select to authenticated using (public.is_admin() or staff_id = public.current_staff_id());
create policy finance_read on public.financial_transactions for select to authenticated using (public.is_admin() and center_id = public.current_center_id());
create policy audit_read on public.audit_logs for select to authenticated using (public.is_admin() and center_id = public.current_center_id());

revoke all on function public.current_center_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_staff_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.has_class_assignment(uuid, date) from public;
revoke all on function public.write_audit(text, text, uuid, jsonb, jsonb, text) from public;

grant usage on schema public to authenticated;
grant select on public.centers, public.profiles, public.staff, public.classes, public.class_schedules, public.students, public.enrollments, public.class_assignments, public.class_sessions, public.attendance, public.student_evaluations, public.staff_attendance, public.financial_transactions, public.audit_logs to authenticated;

revoke all on function public.rpc_upsert_staff(uuid, text, text, public.staff_type, text, text, text, public.entity_status, text) from public;
revoke all on function public.rpc_upsert_class(uuid, text, text, smallint, text, text, public.entity_status, text) from public;
revoke all on function public.rpc_upsert_student(uuid, text, text, text, text, text, text, public.entity_status, text) from public;
revoke all on function public.rpc_upsert_enrollment(uuid, uuid, uuid, date, date, text, text) from public;
revoke all on function public.rpc_upsert_assignment(uuid, uuid, uuid, public.assignment_role, date, date, boolean, text) from public;
revoke all on function public.rpc_upsert_schedule(uuid, uuid, smallint, time, time, boolean, text) from public;
revoke all on function public.rpc_deactivate_entity(text, uuid, text) from public;
revoke all on function public.rpc_generate_sessions(date, date, text) from public;
revoke all on function public.rpc_upsert_attendance(uuid, jsonb, text) from public;
revoke all on function public.rpc_upsert_evaluations(uuid, jsonb, text) from public;
revoke all on function public.rpc_upsert_staff_attendance(uuid, date, public.staff_attendance_status, text, text) from public;
revoke all on function public.rpc_record_financial_transaction(uuid, date, public.financial_transaction_type, text, text, bigint, text) from public;
revoke all on function public.rpc_link_staff_account(uuid, uuid, text) from public;
revoke all on function public.rpc_dashboard_summary(date, date) from public;

grant execute on function public.current_center_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_class_assignment(uuid, date) to authenticated;
grant execute on function public.rpc_upsert_staff(uuid, text, text, public.staff_type, text, text, text, public.entity_status, text) to authenticated;
grant execute on function public.rpc_upsert_class(uuid, text, text, smallint, text, text, public.entity_status, text) to authenticated;
grant execute on function public.rpc_upsert_student(uuid, text, text, text, text, text, text, public.entity_status, text) to authenticated;
grant execute on function public.rpc_upsert_enrollment(uuid, uuid, uuid, date, date, text, text) to authenticated;
grant execute on function public.rpc_upsert_assignment(uuid, uuid, uuid, public.assignment_role, date, date, boolean, text) to authenticated;
grant execute on function public.rpc_upsert_schedule(uuid, uuid, smallint, time, time, boolean, text) to authenticated;
grant execute on function public.rpc_deactivate_entity(text, uuid, text) to authenticated;
grant execute on function public.rpc_generate_sessions(date, date, text) to authenticated;
grant execute on function public.rpc_upsert_attendance(uuid, jsonb, text) to authenticated;
grant execute on function public.rpc_upsert_evaluations(uuid, jsonb, text) to authenticated;
grant execute on function public.rpc_upsert_staff_attendance(uuid, date, public.staff_attendance_status, text, text) to authenticated;
grant execute on function public.rpc_record_financial_transaction(uuid, date, public.financial_transaction_type, text, text, bigint, text) to authenticated;
grant execute on function public.rpc_link_staff_account(uuid, uuid, text) to authenticated;
grant execute on function public.rpc_dashboard_summary(date, date) to authenticated;

commit;
