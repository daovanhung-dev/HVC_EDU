begin;

-- Additive workflow layer for the simplified HVC_EDU application.
-- Existing financial, enrollment and audit history is intentionally preserved.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'work_attendance_status') then
    create type public.work_attendance_status as enum ('IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED');
  end if;
end;
$$;

create table if not exists public.period_class_configs (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  active boolean not null default true,
  unit_fee bigint not null check (unit_fee >= 0),
  collection_method public.collection_method not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, class_id)
);

create table if not exists public.period_settings (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (period_id, key)
);

create table if not exists public.staff_work_attendance (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status public.work_attendance_status not null default 'IN_PROGRESS',
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, staff_id),
  check (check_out_at is null or check_in_at is not null),
  check (check_out_at is null or check_in_at is null or check_out_at > check_in_at)
);

create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  availability_date date not null,
  start_time time not null,
  end_time time not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, availability_date, start_time, end_time),
  check (end_time > start_time)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  severity text not null default 'INFO' check (severity in ('INFO', 'WARNING', 'BLOCKED')),
  action_route text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null default gen_random_uuid()::text,
  created_by uuid references auth.users(id),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (center_id, recipient_user_id, dedupe_key)
);

create index if not exists period_class_configs_period_idx on public.period_class_configs(period_id, active);
create index if not exists period_class_configs_class_idx on public.period_class_configs(class_id, period_id);
create index if not exists period_settings_period_idx on public.period_settings(period_id, key);
create index if not exists staff_work_attendance_session_idx on public.staff_work_attendance(session_id, status);
create index if not exists staff_work_attendance_staff_idx on public.staff_work_attendance(staff_id, status);
create index if not exists staff_availability_staff_date_idx on public.staff_availability(staff_id, availability_date);
create index if not exists notifications_recipient_idx on public.notifications(recipient_user_id, read_at, created_at desc);
create index if not exists notifications_center_idx on public.notifications(center_id, created_at desc);

drop trigger if exists touch_updated_at on public.period_class_configs;
create trigger touch_updated_at before update on public.period_class_configs
for each row execute function public.touch_updated_at();
drop trigger if exists touch_updated_at on public.period_settings;
create trigger touch_updated_at before update on public.period_settings
for each row execute function public.touch_updated_at();
drop trigger if exists touch_updated_at on public.staff_work_attendance;
create trigger touch_updated_at before update on public.staff_work_attendance
for each row execute function public.touch_updated_at();
drop trigger if exists touch_updated_at on public.staff_availability;
create trigger touch_updated_at before update on public.staff_availability
for each row execute function public.touch_updated_at();

-- Existing periods receive read-only-compatible snapshots. No attendance is fabricated.
insert into public.period_class_configs(period_id, class_id, active, unit_fee, collection_method, note)
select p.id, c.id, c.status = 'ACTIVE', c.standard_unit_fee, c.collection_method, c.note
from public.accounting_periods p
join public.classes c on c.center_id = p.center_id
on conflict (period_id, class_id) do nothing;

insert into public.period_settings(period_id, key, value_json)
select p.id, 'payroll_basis', '"LEGACY_ASSIGNMENT"'::jsonb
from public.accounting_periods p
on conflict (period_id, key) do nothing;

create or replace function public.rpc_create_month_setup(
  p_source_period_id uuid,
  p_period jsonb,
  p_class_configs jsonb,
  p_enrollment_actions jsonb,
  p_schedules jsonb,
  p_assignments jsonb,
  p_settings jsonb,
  p_carry_over boolean default true,
  p_trace_id text default gen_random_uuid()::text,
  p_new_classes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_center_id uuid := public.current_center_id();
  v_period_id uuid;
  v_source record;
  v_year int;
  v_month int;
  v_start date;
  v_end date;
  v_date date;
  v_cfg record;
  v_new_class record;
  v_schedule record;
  v_assignment record;
  v_action record;
  v_setting record;
  v_ledger record;
  v_class record;
  v_staff record;
  v_source_enrollment record;
  v_new_class_id uuid;
  v_created_classes int := 0;
  v_created_schedules int := 0;
  v_created_sessions int := 0;
  v_created_assignments int := 0;
  v_created_enrollments int := 0;
  v_carried int := 0;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_period is null or jsonb_typeof(p_period) <> 'object' then raise exception using message = 'VALIDATION_ERROR'; end if;

  v_year := nullif(p_period->>'year', '')::int;
  v_month := nullif(p_period->>'month', '')::int;
  v_start := nullif(p_period->>'start_date', '')::date;
  v_end := nullif(p_period->>'end_date', '')::date;
  if v_year not between 2020 and 2100 or v_month not between 1 and 12 or v_start is null or v_end is null or v_end < v_start then
    raise exception using message = 'VALIDATION_ERROR';
  end if;
  if exists (select 1 from public.accounting_periods where center_id = v_center_id and year = v_year and month = v_month) then
    raise exception using message = 'CONFLICT';
  end if;

  if p_source_period_id is not null then
    select * into v_source from public.accounting_periods where id = p_source_period_id and center_id = v_center_id;
    if not found then raise exception using message = 'PERIOD_NOT_FOUND'; end if;
    if v_source.status <> 'CLOSED' then raise exception using message = 'SOURCE_PERIOD_NOT_CLOSED'; end if;
  end if;

  insert into public.accounting_periods(center_id, year, month, start_date, end_date, status)
  values (v_center_id, v_year, v_month, v_start, v_end, 'OPEN')
  returning id into v_period_id;

  for v_new_class in select * from jsonb_to_recordset(coalesce(p_new_classes, '[]'::jsonb)) as x(
    code text, name text, grade int, subject text, unit_fee bigint, collection_method text, note text
  ) loop
    if coalesce(trim(v_new_class.code), '') = '' or coalesce(trim(v_new_class.name), '') = '' or coalesce(trim(v_new_class.subject), '') = ''
       or v_new_class.grade not between 1 and 12 or v_new_class.unit_fee is null or v_new_class.unit_fee < 0
       or v_new_class.collection_method not in ('PER_SESSION', 'PREPAID') then raise exception using message = 'VALIDATION_ERROR'; end if;
    insert into public.classes(center_id, code, name, grade, subject, standard_unit_fee, collection_method, note)
    values (v_center_id, trim(v_new_class.code), trim(v_new_class.name), v_new_class.grade, trim(v_new_class.subject), v_new_class.unit_fee, v_new_class.collection_method::public.collection_method, v_new_class.note)
    returning id into v_new_class_id;
    insert into public.period_class_configs(period_id, class_id, active, unit_fee, collection_method, note, created_by)
    values (v_period_id, v_new_class_id, true, v_new_class.unit_fee, v_new_class.collection_method::public.collection_method, v_new_class.note, v_user);
    v_created_classes := v_created_classes + 1;
  end loop;

  for v_cfg in select * from jsonb_to_recordset(coalesce(p_class_configs, '[]'::jsonb)) as x(
    class_id uuid, active boolean, unit_fee bigint, collection_method text, note text
  ) loop
    select * into v_class from public.classes where id = v_cfg.class_id and center_id = v_center_id;
    if not found then raise exception using message = 'CLASS_NOT_FOUND'; end if;
    if v_cfg.unit_fee is null or v_cfg.unit_fee < 0 or v_cfg.collection_method not in ('PER_SESSION', 'PREPAID') then
      raise exception using message = 'VALIDATION_ERROR';
    end if;
    insert into public.period_class_configs(period_id, class_id, active, unit_fee, collection_method, note, created_by)
    values (v_period_id, v_cfg.class_id, coalesce(v_cfg.active, true), v_cfg.unit_fee, v_cfg.collection_method::public.collection_method, v_cfg.note, v_user);
    v_created_classes := v_created_classes + 1;
  end loop;

  for v_schedule in select * from jsonb_to_recordset(coalesce(p_schedules, '[]'::jsonb)) as x(
    class_id uuid, weekday int, start_time time, end_time time, active boolean
  ) loop
    if not exists (select 1 from public.period_class_configs where period_id = v_period_id and class_id = v_schedule.class_id and active = true) then
      continue;
    end if;
    if v_schedule.weekday not between 1 and 7 or v_schedule.end_time is not null and v_schedule.start_time is null or v_schedule.end_time is not null and v_schedule.end_time <= v_schedule.start_time then
      raise exception using message = 'VALIDATION_ERROR';
    end if;
    if coalesce(v_schedule.active, true) then
      insert into public.class_schedules(class_id, weekday, start_time, end_time, effective_from, effective_to, active)
      values (v_schedule.class_id, v_schedule.weekday, v_schedule.start_time, v_schedule.end_time, v_start, v_end, true);
      v_created_schedules := v_created_schedules + 1;
    end if;
  end loop;

  -- Session generation is part of the same transaction as the setup. A failure
  -- here rolls back the period, snapshots, roster changes and assignments.
  for v_cfg in select class_id from public.period_class_configs where period_id=v_period_id and active=true loop
    v_date := v_start;
    while v_date <= v_end loop
      for v_schedule in
        select s.* from public.class_schedules s
        where s.class_id=v_cfg.class_id and s.active=true
          and s.weekday=extract(isodow from v_date)::smallint
          and s.effective_from <= v_date
          and (s.effective_to is null or s.effective_to >= v_date)
      loop
        if not exists (select 1 from public.class_sessions cs where cs.class_id=v_cfg.class_id and cs.session_date=v_date and cs.start_time is not distinct from v_schedule.start_time) then
          insert into public.class_sessions(class_id, period_id, session_date, start_time, end_time, status)
          values (v_cfg.class_id, v_period_id, v_date, v_schedule.start_time, v_schedule.end_time, 'SCHEDULED');
          v_created_sessions := v_created_sessions + 1;
        end if;
      end loop;
      v_date := v_date + 1;
    end loop;
  end loop;

  for v_assignment in select * from jsonb_to_recordset(coalesce(p_assignments, '[]'::jsonb)) as x(
    class_id uuid, staff_id uuid, role text, planned_sessions int
  ) loop
    select * into v_class from public.classes where id = v_assignment.class_id and center_id = v_center_id;
    if not found or not exists (select 1 from public.period_class_configs where period_id = v_period_id and class_id = v_assignment.class_id and active = true) then
      raise exception using message = 'CLASS_NOT_FOUND';
    end if;
    select * into v_staff from public.staff where id = v_assignment.staff_id and center_id = v_center_id and status = 'ACTIVE';
    if not found then raise exception using message = 'STAFF_NOT_FOUND'; end if;
    if v_assignment.role not in ('MAIN_TEACHER', 'ASSISTANT') or v_assignment.planned_sessions is not null and v_assignment.planned_sessions < 0 then
      raise exception using message = 'VALIDATION_ERROR';
    end if;
    if (v_assignment.role = 'ASSISTANT' and v_staff.staff_type <> 'ASSISTANT') or (v_assignment.role = 'MAIN_TEACHER' and v_staff.staff_type <> 'TEACHER') then
      raise exception using message = 'VALIDATION_ERROR';
    end if;
    insert into public.class_assignments(class_id, staff_id, period_id, role, planned_sessions, start_date, end_date)
    values (v_assignment.class_id, v_assignment.staff_id, v_period_id, v_assignment.role::public.assignment_role, v_assignment.planned_sessions, v_start, v_end);
    v_created_assignments := v_created_assignments + 1;
  end loop;

  for v_action in select * from jsonb_to_recordset(coalesce(p_enrollment_actions, '[]'::jsonb)) as x(
    action text, student_id uuid, class_id uuid, source_enrollment_id uuid, enrolled_from date,
    unit_price_override bigint, tuition_exempt boolean, note text
  ) loop
    if v_action.action not in ('KEEP', 'ADD', 'MOVE', 'LEAVE', 'REENTRY') then raise exception using message = 'VALIDATION_ERROR'; end if;
    if v_action.unit_price_override is not null and v_action.unit_price_override < 0 then raise exception using message = 'VALIDATION_ERROR'; end if;
    if v_action.action = 'LEAVE' then
      update public.enrollments
      set status = 'LEFT', enrolled_to = least(coalesce(enrolled_to, v_start - 1), v_start - 1), updated_at = now()
      where id = v_action.source_enrollment_id and student_id = v_action.student_id and class_id = v_action.class_id and status = 'ACTIVE';
      if not found then raise exception using message = 'ENROLLMENT_NOT_FOUND'; end if;
      continue;
    end if;
    if not exists (select 1 from public.classes where id = v_action.class_id and center_id = v_center_id and status = 'ACTIVE') then raise exception using message = 'CLASS_NOT_FOUND'; end if;
    if not exists (select 1 from public.students where id = v_action.student_id and center_id = v_center_id and status = 'ACTIVE') then raise exception using message = 'STUDENT_NOT_FOUND'; end if;
    if v_action.action = 'KEEP' then
      if not exists (select 1 from public.enrollments where id = v_action.source_enrollment_id and student_id = v_action.student_id and class_id = v_action.class_id and status = 'ACTIVE') then
        raise exception using message = 'ENROLLMENT_NOT_FOUND';
      end if;
      continue;
    end if;
    if v_action.action = 'MOVE' then
      update public.enrollments
      set status = 'LEFT', enrolled_to = v_start - 1, updated_at = now()
      where id = v_action.source_enrollment_id and student_id = v_action.student_id and status = 'ACTIVE';
      if not found then raise exception using message = 'ENROLLMENT_NOT_FOUND'; end if;
    end if;
    if exists (select 1 from public.enrollments where student_id = v_action.student_id and class_id = v_action.class_id and status = 'ACTIVE') then
      raise exception using message = 'CONFLICT';
    end if;
    if v_action.action = 'REENTRY' and exists (select 1 from public.enrollments where id = v_action.source_enrollment_id and status = 'ACTIVE') then
      raise exception using message = 'CONFLICT';
    end if;
    insert into public.enrollments(student_id, class_id, enrolled_from, status, unit_price_override, tuition_exempt, note)
    values (v_action.student_id, v_action.class_id, coalesce(v_action.enrolled_from, v_start), 'ACTIVE', v_action.unit_price_override, coalesce(v_action.tuition_exempt, false), v_action.note);
    v_created_enrollments := v_created_enrollments + 1;
  end loop;

  insert into public.period_settings(period_id, key, value_json, updated_by)
  values (v_period_id, 'payroll_basis', '"APPROVED_WORK_ATTENDANCE"'::jsonb, v_user)
  on conflict (period_id, key) do update set value_json = excluded.value_json, updated_by = excluded.updated_by;
  for v_setting in select key, value from jsonb_each(coalesce(p_settings, '{}'::jsonb)) loop
    insert into public.period_settings(period_id, key, value_json, updated_by)
    values (v_period_id, v_setting.key, v_setting.value, v_user)
    on conflict (period_id, key) do update set value_json = excluded.value_json, updated_by = excluded.updated_by;
  end loop;

  if p_carry_over and p_source_period_id is not null then
    for v_ledger in select l.* from public.tuition_ledgers l where l.period_id = p_source_period_id and l.debt_amount > 0 loop
      insert into public.tuition_adjustments(period_id, enrollment_id, type, amount, reason, source_period_id, created_by)
      values (v_period_id, v_ledger.enrollment_id, 'CARRY_IN', v_ledger.debt_amount, 'Carry-over từ kỳ trước', p_source_period_id, v_user)
      on conflict (period_id, enrollment_id, type, source_period_id) where source_period_id is not null do nothing;
      insert into public.tuition_adjustments(period_id, enrollment_id, type, amount, reason, source_period_id, created_by)
      values (p_source_period_id, v_ledger.enrollment_id, 'CARRY_OUT', v_ledger.debt_amount, 'Carry-over sang kỳ mới', v_period_id, v_user)
      on conflict (period_id, enrollment_id, type, source_period_id) where source_period_id is not null do nothing;
      v_carried := v_carried + 1;
    end loop;
  end if;

  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (v_center_id, v_user, 'MONTH_SETUP_CREATED', 'accounting_period', v_period_id::text,
    jsonb_build_object('source_period_id', p_source_period_id, 'classes', v_created_classes, 'schedules', v_created_schedules,
      'assignments', v_created_assignments, 'sessions', v_created_sessions, 'enrollments', v_created_enrollments, 'carried_over', v_carried), p_trace_id);
  return jsonb_build_object('period_id', v_period_id, 'classes', v_created_classes, 'schedules', v_created_schedules,
    'sessions', v_created_sessions, 'assignments', v_created_assignments, 'enrollments', v_created_enrollments, 'carried_over', v_carried);
end;
$$;

create or replace function public.rpc_submit_staff_work_attendance(
  p_session_id uuid,
  p_action text,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_staff_id uuid := public.current_staff_id();
  v_session record;
  v_row record;
  v_id uuid;
  v_now timestamptz := now();
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if v_staff_id is null or p_action not in ('CHECK_IN', 'CHECK_OUT') then raise exception using message = 'VALIDATION_ERROR'; end if;
  select s.id, s.class_id, s.period_id, s.session_date, s.status, p.status as period_status, c.center_id
  into v_session
  from public.class_sessions s join public.accounting_periods p on p.id = s.period_id join public.classes c on c.id = s.class_id
  where s.id = p_session_id and c.center_id = public.current_center_id();
  if not found then raise exception using message = 'SESSION_NOT_FOUND'; end if;
  if v_session.period_status <> 'OPEN' then raise exception using message = 'PERIOD_CLOSED'; end if;
  if v_session.status = 'CANCELLED' then raise exception using message = 'SESSION_CANCELLED'; end if;
  if not exists (
    select 1 from public.class_assignments a
    where a.class_id = v_session.class_id and a.staff_id = v_staff_id
      and (a.period_id = v_session.period_id or a.period_id is null)
      and a.start_date <= v_session.session_date and (a.end_date is null or a.end_date >= v_session.session_date)
  ) then raise exception using message = 'CLASS_NOT_ASSIGNED'; end if;

  select * into v_row from public.staff_work_attendance where session_id = p_session_id and staff_id = v_staff_id for update;
  if p_action = 'CHECK_IN' then
    if found and v_row.status in ('IN_PROGRESS', 'SUBMITTED', 'APPROVED') then raise exception using message = 'WORK_ATTENDANCE_ALREADY_STARTED'; end if;
    if found then
      update public.staff_work_attendance set check_in_at = v_now, check_out_at = null, status = 'IN_PROGRESS', submitted_at = null,
        reviewed_by = null, reviewed_at = null, rejection_reason = null, note = coalesce(p_note, note), updated_at = v_now where id = v_row.id returning id into v_id;
    else
      insert into public.staff_work_attendance(center_id, session_id, staff_id, check_in_at, status, note)
      values (v_session.center_id, p_session_id, v_staff_id, v_now, 'IN_PROGRESS', p_note) returning id into v_id;
    end if;
  else
    if not found or v_row.status <> 'IN_PROGRESS' or v_row.check_in_at is null then raise exception using message = 'WORK_ATTENDANCE_CHECK_IN_REQUIRED'; end if;
    update public.staff_work_attendance set check_out_at = v_now, submitted_at = v_now, status = 'SUBMITTED', note = coalesce(p_note, note), updated_at = v_now where id = v_row.id returning id into v_id;
    insert into public.notifications(center_id, recipient_user_id, type, title, message, severity, action_route, metadata, dedupe_key, created_by)
    select v_session.center_id, p.user_id, 'WORK_ATTENDANCE_SUBMITTED', 'Có request công chờ duyệt',
      'Một nhân sự đã check-out và gửi công của buổi học.', 'WARNING', '/staff?tab=work-approval', jsonb_build_object('work_attendance_id', v_id, 'session_id', p_session_id),
      'WORK_ATTENDANCE_SUBMITTED:' || v_id::text, v_user
    from public.profiles p where p.center_id = v_session.center_id and p.active = true and p.role = 'ADMIN'
    on conflict (center_id, recipient_user_id, dedupe_key) do nothing;
  end if;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (v_session.center_id, v_user, 'STAFF_WORK_ATTENDANCE_' || p_action, 'staff_work_attendance', v_id::text,
    jsonb_build_object('session_id', p_session_id, 'staff_id', v_staff_id, 'action', p_action), p_trace_id);
  select * into v_row from public.staff_work_attendance where id = v_id;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.rpc_review_staff_work_attendance(
  p_work_attendance_id uuid,
  p_decision text,
  p_check_in_at timestamptz default null,
  p_check_out_at timestamptz default null,
  p_rejection_reason text default null,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row record;
  v_before jsonb;
  v_staff_user uuid;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception using message = 'VALIDATION_ERROR'; end if;
  select w.*, p.status as period_status, p.center_id as period_center_id
  into v_row
  from public.staff_work_attendance w join public.class_sessions s on s.id = w.session_id
  join public.accounting_periods p on p.id = s.period_id
  where w.id = p_work_attendance_id and w.center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'WORK_ATTENDANCE_NOT_FOUND'; end if;
  if v_row.period_status <> 'OPEN' then raise exception using message = 'PERIOD_CLOSED'; end if;
  if v_row.status not in ('SUBMITTED', 'REJECTED') then raise exception using message = 'WORK_ATTENDANCE_NOT_SUBMITTED'; end if;
  v_before := to_jsonb(v_row);
  if p_decision = 'APPROVED' then
    if coalesce(p_check_in_at, v_row.check_in_at) is null or coalesce(p_check_out_at, v_row.check_out_at) is null
       or coalesce(p_check_out_at, v_row.check_out_at) <= coalesce(p_check_in_at, v_row.check_in_at) then
      raise exception using message = 'VALIDATION_ERROR';
    end if;
    update public.staff_work_attendance set check_in_at = coalesce(p_check_in_at, check_in_at), check_out_at = coalesce(p_check_out_at, check_out_at),
      status = 'APPROVED', reviewed_by = v_user, reviewed_at = now(), rejection_reason = null, note = coalesce(p_note, note), updated_at = now()
    where id = p_work_attendance_id;
  else
    if coalesce(trim(p_rejection_reason), '') = '' then raise exception using message = 'VALIDATION_ERROR'; end if;
    update public.staff_work_attendance set status = 'REJECTED', reviewed_by = v_user, reviewed_at = now(), rejection_reason = trim(p_rejection_reason), note = coalesce(p_note, note), updated_at = now()
    where id = p_work_attendance_id;
  end if;
  select p.user_id into v_staff_user from public.profiles p where p.staff_id = v_row.staff_id and p.active = true limit 1;
  if v_staff_user is not null then
    insert into public.notifications(center_id, recipient_user_id, type, title, message, severity, action_route, metadata, dedupe_key, created_by)
    values (v_row.period_center_id, v_staff_user,
      'WORK_ATTENDANCE_' || p_decision,
      case when p_decision = 'APPROVED' then 'Công đã được duyệt' else 'Công cần gửi lại' end,
      case when p_decision = 'APPROVED' then 'Request công của bạn đã được Admin duyệt.' else 'Request công của bạn bị từ chối: ' || trim(p_rejection_reason) end,
      case when p_decision = 'APPROVED' then 'INFO' else 'WARNING' end, '/work', jsonb_build_object('work_attendance_id', p_work_attendance_id),
      'WORK_ATTENDANCE_REVIEW:' || p_work_attendance_id::text || ':' || p_decision || ':' || coalesce(p_trace_id, gen_random_uuid()::text), v_user);
  end if;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, before_data, after_data, trace_id)
  values (v_row.period_center_id, v_user, 'STAFF_WORK_ATTENDANCE_' || p_decision, 'staff_work_attendance', p_work_attendance_id::text,
    v_before, (select to_jsonb(w) from public.staff_work_attendance w where w.id = p_work_attendance_id), p_trace_id);
  return (select to_jsonb(w) from public.staff_work_attendance w where w.id = p_work_attendance_id);
end;
$$;

create or replace function public.rpc_upsert_staff_availability(
  p_staff_id uuid,
  p_availability_date date,
  p_start_time time,
  p_end_time time,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_target uuid := coalesce(p_staff_id, public.current_staff_id());
  v_center_id uuid := public.current_center_id();
  v_id uuid;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if v_target is null or p_availability_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then raise exception using message = 'VALIDATION_ERROR'; end if;
  if not public.is_admin() and v_target <> public.current_staff_id() then raise exception using message = 'FORBIDDEN'; end if;
  if not exists (select 1 from public.staff where id = v_target and center_id = v_center_id and status = 'ACTIVE') then raise exception using message = 'STAFF_NOT_FOUND'; end if;
  insert into public.staff_availability(center_id, staff_id, availability_date, start_time, end_time, note, created_by)
  values (v_center_id, v_target, p_availability_date, p_start_time, p_end_time, p_note, v_user)
  on conflict (staff_id, availability_date, start_time, end_time) do update set note = excluded.note, updated_at = now()
  returning id into v_id;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (v_center_id, v_user, 'STAFF_AVAILABILITY_UPSERTED', 'staff_availability', v_id::text,
    jsonb_build_object('staff_id', v_target, 'availability_date', p_availability_date, 'start_time', p_start_time, 'end_time', p_end_time), p_trace_id);
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.rpc_send_notification(
  p_scope text,
  p_role text,
  p_recipient_user_id uuid,
  p_title text,
  p_message text,
  p_severity text default 'INFO',
  p_action_route text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_center_id uuid := public.current_center_id();
  v_key text := coalesce(nullif(trim(p_dedupe_key), ''), 'MANUAL:' || gen_random_uuid()::text);
  v_count int;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_scope not in ('ALL', 'ROLE', 'USER') or coalesce(trim(p_title), '') = '' or coalesce(trim(p_message), '') = '' or p_severity not in ('INFO', 'WARNING', 'BLOCKED') then
    raise exception using message = 'VALIDATION_ERROR';
  end if;
  if p_scope = 'ROLE' and p_role not in ('ADMIN', 'ACCOUNTANT', 'TEACHER', 'ASSISTANT') then raise exception using message = 'VALIDATION_ERROR'; end if;
  if p_scope = 'USER' and not exists (select 1 from public.profiles where user_id = p_recipient_user_id and center_id = v_center_id and active = true) then raise exception using message = 'PROFILE_NOT_FOUND'; end if;
  insert into public.notifications(center_id, recipient_user_id, type, title, message, severity, action_route, metadata, dedupe_key, created_by)
  select v_center_id, p.user_id, 'MANUAL', trim(p_title), trim(p_message), p_severity, p_action_route, coalesce(p_metadata, '{}'::jsonb), v_key, v_user
  from public.profiles p
  where p.center_id = v_center_id and p.active = true
    and (p_scope = 'ALL' or p_scope = 'ROLE' and p.role::text = p_role or p_scope = 'USER' and p.user_id = p_recipient_user_id)
  on conflict (center_id, recipient_user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (v_center_id, v_user, 'NOTIFICATION_SENT', 'notification', v_key,
    jsonb_build_object('scope', p_scope, 'role', p_role, 'recipient_user_id', p_recipient_user_id, 'count', v_count), p_trace_id);
  return jsonb_build_object('created', v_count, 'dedupe_key', v_key);
end;
$$;

create or replace function public.rpc_mark_notification_read(
  p_notification_id uuid,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  update public.notifications set read_at = coalesce(read_at, now()) where id = p_notification_id and recipient_user_id = v_user and center_id = public.current_center_id() returning id into v_id;
  if v_id is null then raise exception using message = 'NOTIFICATION_NOT_FOUND'; end if;
  return jsonb_build_object('id', v_id, 'read', true);
end;
$$;

create or replace function public.rpc_mark_all_notifications_read(
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  update public.notifications set read_at = now() where recipient_user_id = v_user and center_id = public.current_center_id() and read_at is null;
  get diagnostics v_count = row_count;
  return jsonb_build_object('updated', v_count);
end;
$$;

create or replace function public.rpc_publish_admin_notification(
  p_type text,
  p_title text,
  p_message text,
  p_severity text default 'WARNING',
  p_action_route text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_dedupe_key text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_center_id uuid := public.current_center_id();
  v_key text := coalesce(nullif(trim(p_dedupe_key), ''), p_type || ':' || gen_random_uuid()::text);
  v_count int;
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_type), '') = '' or coalesce(trim(p_title), '') = '' or coalesce(trim(p_message), '') = '' or p_severity not in ('INFO', 'WARNING', 'BLOCKED') then
    raise exception using message='VALIDATION_ERROR';
  end if;
  insert into public.notifications(center_id, recipient_user_id, type, title, message, severity, action_route, metadata, dedupe_key, created_by)
  select v_center_id, p.user_id, p_type, trim(p_title), trim(p_message), p_severity, p_action_route, coalesce(p_metadata, '{}'::jsonb), v_key, v_user
  from public.profiles p where p.center_id=v_center_id and p.active=true and p.role='ADMIN'
  on conflict (center_id, recipient_user_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (v_center_id, v_user, 'AUTOMATIC_NOTIFICATION_PUBLISHED', 'notification', v_key,
    jsonb_build_object('type', p_type, 'count', v_count, 'metadata', coalesce(p_metadata, '{}'::jsonb)), p_trace_id);
  return jsonb_build_object('created', v_count, 'dedupe_key', v_key);
end;
$$;

alter table public.period_class_configs enable row level security;
alter table public.period_settings enable row level security;
alter table public.staff_work_attendance enable row level security;
alter table public.staff_availability enable row level security;
alter table public.notifications enable row level security;

create policy period_class_configs_read on public.period_class_configs for select to authenticated using (
  exists (select 1 from public.accounting_periods p where p.id = period_id and p.center_id = public.current_center_id())
  and (public.is_accountant() or public.has_class_assignment(class_id, current_date))
);
create policy period_settings_read on public.period_settings for select to authenticated using (
  exists (select 1 from public.accounting_periods p where p.id = period_id and p.center_id = public.current_center_id())
  and public.is_accountant()
);
create policy staff_work_attendance_read on public.staff_work_attendance for select to authenticated using (
  center_id = public.current_center_id()
  and (public.is_accountant() or staff_id = public.current_staff_id() or exists (
    select 1 from public.class_sessions s where s.id = session_id and public.has_class_assignment(s.class_id, s.session_date)
  ))
);
create policy staff_availability_read on public.staff_availability for select to authenticated using (
  center_id = public.current_center_id() and (public.is_accountant() or staff_id = public.current_staff_id())
);
create policy notifications_read on public.notifications for select to authenticated using (
  center_id = public.current_center_id() and recipient_user_id = auth.uid()
);

grant select on public.period_class_configs, public.period_settings, public.staff_work_attendance, public.staff_availability, public.notifications to authenticated;
grant execute on function public.rpc_create_month_setup(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,boolean,text,jsonb) to authenticated;
grant execute on function public.rpc_submit_staff_work_attendance(uuid,text,text,text) to authenticated;
grant execute on function public.rpc_review_staff_work_attendance(uuid,text,timestamptz,timestamptz,text,text,text) to authenticated;
grant execute on function public.rpc_upsert_staff_availability(uuid,date,time,time,text,text) to authenticated;
grant execute on function public.rpc_send_notification(text,text,uuid,text,text,text,text,jsonb,text,text) to authenticated;
grant execute on function public.rpc_mark_notification_read(uuid,text) to authenticated;
grant execute on function public.rpc_mark_all_notifications_read(text) to authenticated;
grant execute on function public.rpc_publish_admin_notification(text,text,text,text,text,jsonb,text,text) to authenticated;

-- New periods use the period snapshot rather than mutable class master values.
create or replace function public.rpc_generate_month_sessions(
  p_class_id uuid,
  p_period_id uuid,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_period record;
  v_class record;
  v_date date;
  v_schedule record;
  v_created int := 0;
  v_existing int := 0;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  select * into v_class from public.classes where id = p_class_id and center_id = public.current_center_id();
  if not found then raise exception using message = 'CLASS_NOT_FOUND'; end if;
  select * into v_period from public.accounting_periods where id = p_period_id and center_id = public.current_center_id() for update;
  if not found then raise exception using message = 'PERIOD_NOT_FOUND'; end if;
  if v_period.status <> 'OPEN' then raise exception using message = 'PERIOD_NOT_OPEN'; end if;
  if not exists (select 1 from public.period_class_configs where period_id = p_period_id and class_id = p_class_id and active = true) then
    raise exception using message = 'CLASS_NOT_FOUND';
  end if;
  v_date := v_period.start_date;
  while v_date <= v_period.end_date loop
    for v_schedule in
      select s.* from public.class_schedules s
      where s.class_id = p_class_id and s.active = true
        and s.weekday = extract(isodow from v_date)::smallint
        and s.effective_from <= v_date
        and (s.effective_to is null or s.effective_to >= v_date)
    loop
      if exists (select 1 from public.class_sessions cs where cs.class_id = p_class_id and cs.session_date = v_date and cs.start_time is not distinct from v_schedule.start_time) then
        v_existing := v_existing + 1;
      else
        insert into public.class_sessions(class_id, period_id, session_date, start_time, end_time, status)
        values (p_class_id, p_period_id, v_date, v_schedule.start_time, v_schedule.end_time, 'SCHEDULED');
        v_created := v_created + 1;
      end if;
    end loop;
    v_date := v_date + 1;
  end loop;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (v_class.center_id, v_user, 'SESSIONS_GENERATED', 'class', p_class_id::text,
    jsonb_build_object('period_id', p_period_id, 'created', v_created, 'existing', v_existing), p_trace_id);
  return jsonb_build_object('created', v_created, 'existing', v_existing);
end;
$$;

create or replace function public.rpc_generate_tuition(
  p_period_id uuid,
  p_class_id uuid default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_period record;
  v_enrollment record;
  v_ledger record;
  v_present int;
  v_absent int;
  v_billable int;
  v_unit bigint;
  v_gross bigint;
  v_opening bigint;
  v_positive bigint;
  v_discount bigint;
  v_due bigint;
  v_paid bigint;
  v_created int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message = 'FORBIDDEN'; end if;
  select * into v_period from public.accounting_periods where id = p_period_id and center_id = public.current_center_id() for update;
  if not found then raise exception using message = 'PERIOD_NOT_FOUND'; end if;
  if v_period.status <> 'OPEN' then raise exception using message = 'PERIOD_NOT_OPEN'; end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id = p_class_id and center_id = public.current_center_id()) then raise exception using message = 'CLASS_NOT_FOUND'; end if;
  for v_enrollment in
    select e.id, e.class_id, e.unit_price_override, e.tuition_exempt,
      coalesce(pc.unit_fee, c.standard_unit_fee) as standard_unit_fee,
      coalesce(pc.collection_method, c.collection_method) as collection_method
    from public.enrollments e join public.classes c on c.id = e.class_id
    left join public.period_class_configs pc on pc.period_id = p_period_id and pc.class_id = e.class_id
    where c.center_id = public.current_center_id() and e.status = 'ACTIVE'
      and coalesce(pc.active, c.status = 'ACTIVE') = true
      and e.enrolled_from <= v_period.end_date and (e.enrolled_to is null or e.enrolled_to >= v_period.start_date)
      and (p_class_id is null or e.class_id = p_class_id)
  loop
    select count(*) filter (where a.status = 'PRESENT'), count(*) filter (where a.status = 'ABSENT')
      into v_present, v_absent
      from public.class_sessions s left join public.attendance a on a.session_id = s.id and a.enrollment_id = v_enrollment.id
      where s.class_id = v_enrollment.class_id and s.period_id = p_period_id and s.status <> 'CANCELLED';
    if v_enrollment.collection_method = 'PREPAID' then
      select count(*) into v_billable from public.class_sessions s where s.class_id = v_enrollment.class_id and s.period_id = p_period_id and s.status <> 'CANCELLED';
    else
      v_billable := v_present;
    end if;
    v_unit := coalesce(v_enrollment.unit_price_override, v_enrollment.standard_unit_fee);
    if v_enrollment.tuition_exempt then v_unit := 0; end if;
    v_gross := v_billable * v_unit;
    select coalesce(sum(case when type in ('OPENING_DEBT','CARRY_IN') then greatest(amount, 0) else 0 end), 0),
      coalesce(sum(case when type = 'MANUAL' then greatest(amount, 0) else 0 end), 0),
      coalesce(sum(case when type = 'DISCOUNT' then greatest(amount, 0) else 0 end), 0)
      into v_opening, v_positive, v_discount
      from public.tuition_adjustments where period_id = p_period_id and enrollment_id = v_enrollment.id;
    v_due := greatest(0, v_gross + v_opening + v_positive - v_discount);
    select coalesce(sum(amount) filter (where voided_at is null), 0) into v_paid
      from public.payments p join public.tuition_ledgers l on l.id = p.tuition_ledger_id
      where l.period_id = p_period_id and l.enrollment_id = v_enrollment.id;
    select * into v_ledger from public.tuition_ledgers where period_id = p_period_id and enrollment_id = v_enrollment.id for update;
    if not found then
      insert into public.tuition_ledgers(period_id, enrollment_id, attended_sessions, absent_sessions, billable_sessions, unit_price, gross_amount, opening_debt, adjustment_amount, amount_due, paid_amount, debt_amount, status)
      values (p_period_id, v_enrollment.id, v_present, v_absent, v_billable, v_unit, v_gross, v_opening, v_positive - v_discount, v_due, v_paid, greatest(0, v_due - v_paid),
        (case when v_paid >= v_due then 'PAID' when v_paid > 0 then 'PARTIAL' else 'CONFIRMED' end)::public.ledger_status);
      v_created := v_created + 1;
    elsif v_ledger.status = 'DRAFT' then
      update public.tuition_ledgers set attended_sessions = v_present, absent_sessions = v_absent, billable_sessions = v_billable,
        unit_price = v_unit, gross_amount = v_gross, opening_debt = v_opening, adjustment_amount = v_positive - v_discount,
        amount_due = v_due, paid_amount = v_paid, debt_amount = greatest(0, v_due - v_paid),
        status = (case when v_paid >= v_due then 'PAID' when v_paid > 0 then 'PARTIAL' else 'CONFIRMED' end)::public.ledger_status, updated_at = now()
      where id = v_ledger.id;
      v_updated := v_updated + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (public.current_center_id(), v_user, 'TUITION_GENERATED', 'accounting_period', p_period_id::text,
    jsonb_build_object('class_id', p_class_id, 'created', v_created, 'updated', v_updated, 'skipped', v_skipped), p_trace_id);
  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped,
    'total_due', (select coalesce(sum(amount_due), 0) from public.tuition_ledgers where period_id = p_period_id));
end;
$$;

create or replace function public.rpc_approve_payroll(
  p_payroll_run_id uuid,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_run record;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  select r.*, p.center_id into v_run
  from public.payroll_runs r join public.accounting_periods p on p.id=r.period_id
  where r.id=p_payroll_run_id and p.center_id=public.current_center_id() for update;
  if not found then raise exception using message='PAYROLL_NOT_FOUND'; end if;
  if v_run.status <> 'DRAFT' then raise exception using message='PAYROLL_ALREADY_APPROVED'; end if;
  update public.payroll_runs set status='APPROVED', approved_at=now(), approved_by=v_user where id=p_payroll_run_id;
  update public.notifications set read_at=coalesce(read_at, now())
  where center_id=v_run.center_id and type='PAYROLL_PENDING_APPROVAL'
    and metadata->>'period_id'=v_run.period_id::text and read_at is null;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (v_run.center_id,v_user,'PAYROLL_APPROVED','payroll_run',p_payroll_run_id::text,jsonb_build_object('total_amount',v_run.total_amount),p_trace_id);
  return jsonb_build_object('payroll_run_id',p_payroll_run_id,'status','APPROVED');
end;
$$;

-- New payroll basis must be fully reviewed before the period can be closed.
-- The legacy close-period rules remain unchanged for backfilled periods.
create or replace function public.rpc_close_period(
  p_period_id uuid,
  p_expected_version bigint,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_period record;
  v_next_period record;
  v_run record;
  v_ledger record;
  v_missing int;
  v_revenue bigint;
  v_other_income bigint;
  v_other_expense bigint;
  v_rewards bigint;
  v_payroll bigint;
  v_profit bigint;
  v_fund_percent numeric := 0.10;
  v_contribution bigint;
  v_distributable bigint;
  v_closing_fund bigint;
  v_payroll_basis text := 'LEGACY_ASSIGNMENT';
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  select * into v_period from public.accounting_periods where id=p_period_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if v_period.status='CLOSED' then return jsonb_build_object('period_id',p_period_id,'status','CLOSED'); end if;
  if p_expected_version is null or v_period.version <> p_expected_version then raise exception using message='VERSION_CONFLICT'; end if;

  select coalesce(value_json #>> '{}', 'LEGACY_ASSIGNMENT') into v_payroll_basis
  from public.period_settings where period_id=p_period_id and key='payroll_basis';
  if not found then v_payroll_basis := 'LEGACY_ASSIGNMENT'; end if;
  if v_payroll_basis = 'APPROVED_WORK_ATTENDANCE' then
    if exists (
      select 1 from public.staff_work_attendance w
      join public.class_sessions s on s.id=w.session_id
      where s.period_id=p_period_id and s.status <> 'CANCELLED'
        and w.status <> 'APPROVED'
    ) or exists (
      select 1
      from public.class_sessions s
      join public.class_assignments a on a.class_id=s.class_id
        and (a.period_id=s.period_id or a.period_id is null)
        and a.start_date <= s.session_date
        and (a.end_date is null or a.end_date >= s.session_date)
      where s.period_id=p_period_id and s.status <> 'CANCELLED'
        and not exists (
          select 1 from public.staff_work_attendance w
          where w.session_id=s.id and w.staff_id=a.staff_id and w.status='APPROVED'
        )
    ) then
      raise exception using message='CLOSE_PERIOD_BLOCKED';
    end if;
  end if;

  select count(*) into v_missing from public.class_sessions s
  where s.period_id=p_period_id and s.status <> 'CANCELLED'
    and not exists (select 1 from public.attendance a where a.session_id=s.id);
  if v_missing > 0 then raise exception using message='CLOSE_PERIOD_BLOCKED'; end if;
  select count(*) into v_missing from public.enrollments e join public.classes c on c.id=e.class_id
  where c.center_id=public.current_center_id() and e.status='ACTIVE' and e.enrolled_from <= v_period.end_date
    and (e.enrolled_to is null or e.enrolled_to >= v_period.start_date)
    and not exists (select 1 from public.tuition_ledgers l where l.period_id=p_period_id and l.enrollment_id=e.id);
  if v_missing > 0 then raise exception using message='CLOSE_PERIOD_BLOCKED'; end if;
  select count(*) into v_missing from public.tuition_ledgers where period_id=p_period_id and status='DRAFT';
  if v_missing > 0 then raise exception using message='CLOSE_PERIOD_BLOCKED'; end if;
  select * into v_run from public.payroll_runs where period_id=p_period_id;
  if not found or v_run.status <> 'APPROVED' then raise exception using message='CLOSE_PERIOD_BLOCKED'; end if;
  if exists (select 1 from public.profit_distributions where period_id=p_period_id)
     and (select coalesce(sum(ratio),0) from public.profit_distributions where period_id=p_period_id) <> 1 then
    raise exception using message='CLOSE_PERIOD_BLOCKED';
  end if;
  if not exists (select 1 from public.profit_distributions where period_id=p_period_id) then raise exception using message='CLOSE_PERIOD_BLOCKED'; end if;

  select coalesce(sum(amount_due),0) into v_revenue from public.tuition_ledgers where period_id=p_period_id;
  select coalesce(sum(amount) filter (where type='INCOME' and voided_at is null),0), coalesce(sum(amount) filter (where type='EXPENSE' and voided_at is null),0)
    into v_other_income,v_other_expense from public.financial_transactions where period_id=p_period_id;
  select coalesce(sum(amount),0) into v_rewards from public.student_rewards where period_id=p_period_id;
  v_payroll := v_run.total_amount;
  select coalesce((value_json->>'fund_percent')::numeric,0.10) into v_fund_percent from public.period_settings where period_id=p_period_id and key='fund';
  if not found then
    select coalesce((value_json->>'fund_percent')::numeric,0.10) into v_fund_percent from public.system_settings where center_id=public.current_center_id() and key='fund';
  end if;
  v_profit := v_revenue + v_other_income - v_payroll - v_rewards - v_other_expense;
  v_contribution := greatest(0,floor(greatest(0,v_profit) * v_fund_percent));
  v_distributable := greatest(0,v_profit-v_contribution);
  insert into public.fund_ledger(period_id,type,amount,note,created_by) values (p_period_id,'CONTRIBUTION',v_contribution,'Fund contribution',v_user)
    on conflict (period_id,type) do update set amount=excluded.amount,note=excluded.note;
  select coalesce(sum(case when f.type in ('OPENING','CONTRIBUTION') then f.amount when f.type='WITHDRAWAL' then -f.amount else 0 end),0)
    into v_closing_fund
    from public.fund_ledger f join public.accounting_periods fp on fp.id=f.period_id
    where fp.center_id=public.current_center_id();
  insert into public.fund_ledger(period_id,type,amount,note,created_by) values (p_period_id,'CLOSING',v_closing_fund,'Fund closing balance',v_user)
    on conflict (period_id,type) do update set amount=excluded.amount,note=excluded.note;
  update public.profit_distributions set amount=floor(v_distributable*ratio) where period_id=p_period_id;
  select * into v_next_period from public.accounting_periods
  where center_id=public.current_center_id() and start_date > v_period.end_date
  order by start_date limit 1 for update;
  if found and v_next_period.status='OPEN' then
    for v_ledger in select * from public.tuition_ledgers where period_id=p_period_id and debt_amount > 0 loop
      insert into public.tuition_adjustments(period_id,enrollment_id,type,amount,reason,source_period_id,created_by)
      values (v_next_period.id,v_ledger.enrollment_id,'CARRY_IN',v_ledger.debt_amount,'Carry-over from period '||v_period.year||'-'||lpad(v_period.month::text,2,'0'),p_period_id,v_user)
      on conflict (period_id,enrollment_id,type,source_period_id) where source_period_id is not null do nothing;
      insert into public.tuition_adjustments(period_id,enrollment_id,type,amount,reason,source_period_id,created_by)
      values (p_period_id,v_ledger.enrollment_id,'CARRY_OUT',v_ledger.debt_amount,'Carried to period '||v_next_period.year||'-'||lpad(v_next_period.month::text,2,'0'),v_next_period.id,v_user)
      on conflict (period_id,enrollment_id,type,source_period_id) where source_period_id is not null do nothing;
    end loop;
  end if;
  update public.accounting_periods set status='CLOSED',closed_at=now(),closed_by=v_user,version=version+1,updated_at=now() where id=p_period_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PERIOD_CLOSED','accounting_period',p_period_id::text,
    jsonb_build_object('payroll_basis',v_payroll_basis,'profit_before_fund',v_profit,'fund_contribution',v_contribution,'distributable_profit',v_distributable),p_trace_id);
  return jsonb_build_object('period_id',p_period_id,'status','CLOSED','profit_before_fund',v_profit,'fund_contribution',v_contribution,'distributable_profit',v_distributable);
end;
$$;

grant execute on function public.rpc_generate_month_sessions(uuid,uuid,text) to authenticated;
grant execute on function public.rpc_generate_tuition(uuid,uuid,text) to authenticated;

commit;
