begin;

-- The initial migration contains the education and finance primitives. This
-- migration closes the gaps required by the business design: fund/profit,
-- import staging, idempotency, indexes, timestamps, and server transactions.

create table if not exists public.fund_ledger (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  type text not null check (type in ('CONTRIBUTION','WITHDRAWAL','OPENING','CLOSING')),
  amount bigint not null check (amount >= 0),
  note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.profit_distributions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  recipient_name text not null,
  recipient_user_id uuid references auth.users(id),
  ratio numeric(7,4) not null check (ratio between 0 and 1),
  amount bigint not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  file_name text not null,
  storage_path text,
  status text not null default 'UPLOADED' check (status in ('UPLOADED','VALIDATING','READY','IMPORTING','COMPLETED','FAILED')),
  mode text not null default 'VALIDATE' check (mode in ('VALIDATE','IMPORT','RECONCILE')),
  summary jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  updated_at timestamptz not null default now()
);

create table if not exists public.import_job_issues (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  severity text not null check (severity in ('ERROR','WARNING')),
  sheet_name text,
  row_number int,
  code text not null,
  message text not null,
  raw_data jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.idempotency_requests (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  operation text not null,
  idempotency_key text not null,
  request_hash text,
  result_json jsonb,
  status text not null default 'STARTED' check (status in ('STARTED','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  unique(center_id, operation, idempotency_key)
);

create unique index if not exists fund_ledger_period_type_uq
  on public.fund_ledger(period_id, type);
create unique index if not exists profit_distribution_period_recipient_uq
  on public.profit_distributions(period_id, recipient_name);
create unique index if not exists tuition_adjustment_carry_uq
  on public.tuition_adjustments(period_id, enrollment_id, type, source_period_id)
  where source_period_id is not null;

create index if not exists profiles_center_role_idx on public.profiles(center_id, role);
create index if not exists classes_center_status_idx on public.classes(center_id, status);
create index if not exists students_center_status_idx on public.students(center_id, status);
create index if not exists enrollments_class_status_idx on public.enrollments(class_id, status);
create index if not exists enrollments_student_status_idx on public.enrollments(student_id, status);
create index if not exists sessions_class_date_idx on public.class_sessions(class_id, session_date);
create index if not exists sessions_period_status_idx on public.class_sessions(period_id, status);
create index if not exists attendance_session_idx on public.attendance(session_id);
create index if not exists attendance_enrollment_idx on public.attendance(enrollment_id);
create index if not exists evaluations_session_idx on public.student_session_evaluations(session_id);
create index if not exists assignments_class_staff_idx on public.class_assignments(class_id, staff_id);
create index if not exists assignments_period_idx on public.class_assignments(period_id);
create index if not exists tuition_period_status_idx on public.tuition_ledgers(period_id, status);
create index if not exists tuition_enrollment_idx on public.tuition_ledgers(enrollment_id);
create index if not exists payments_ledger_date_idx on public.payments(tuition_ledger_id, paid_at);
create index if not exists finance_period_date_idx on public.financial_transactions(period_id, transaction_date);
create index if not exists payroll_period_idx on public.payroll_runs(period_id);
create index if not exists payroll_items_staff_idx on public.payroll_items(payroll_run_id, staff_id);
create index if not exists audit_center_created_idx on public.audit_logs(center_id, created_at);
create index if not exists audit_resource_idx on public.audit_logs(resource_type, resource_id);
create index if not exists import_issues_job_idx on public.import_job_issues(import_job_id, severity);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
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
    'centers','staff','profiles','accounting_periods','classes','class_schedules',
    'students','enrollments','class_sessions','attendance',
    'student_session_evaluations','tuition_ledgers','payroll_policies',
    'financial_transactions','import_jobs'
  ] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', table_name);
  end loop;
end;
$$;

create or replace function public.current_center_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.center_id from public.profiles p
  where p.user_id = auth.uid() and p.active = true limit 1;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$
  select p.role from public.profiles p
  where p.user_id = auth.uid() and p.active = true limit 1;
$$;

create or replace function public.current_staff_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select p.staff_id from public.profiles p
  where p.user_id = auth.uid() and p.active = true limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() = 'ADMIN', false); $$;

create or replace function public.is_accountant()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() in ('ADMIN','ACCOUNTANT'), false); $$;

create or replace function public.is_teacher_or_assistant()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() in ('TEACHER','ASSISTANT'), false); $$;

create or replace function public.has_class_assignment(p_class_id uuid, p_on_date date default current_date)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.center_id = public.current_center_id()
      and (
        public.is_admin() or exists (
          select 1
          from public.class_assignments a
          join public.profiles p on p.staff_id = a.staff_id
          join public.staff s on s.id = a.staff_id
          where p.user_id = auth.uid()
            and p.active = true
            and p.center_id = public.current_center_id()
            and s.center_id = public.current_center_id()
            and a.class_id = p_class_id
            and a.start_date <= p_on_date
            and (a.end_date is null or a.end_date >= p_on_date)
        )
      )
  );
$$;

revoke all on function public.current_center_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_staff_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_accountant() from public;
revoke all on function public.is_teacher_or_assistant() from public;
revoke all on function public.has_class_assignment(uuid,date) from public;
grant execute on function public.current_center_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_accountant() to authenticated;
grant execute on function public.is_teacher_or_assistant() to authenticated;
grant execute on function public.has_class_assignment(uuid,date) to authenticated;

-- Replace the broad init policies with role- and assignment-aware policies.
drop policy if exists centers_read on public.centers;
drop policy if exists profiles_read_self on public.profiles;
drop policy if exists staff_read_center on public.staff;
drop policy if exists classes_read_center on public.classes;
drop policy if exists periods_read_center on public.accounting_periods;
drop policy if exists students_read_center on public.students;
drop policy if exists class_schedules_read_center on public.class_schedules;
drop policy if exists enrollments_read_center on public.enrollments;
drop policy if exists sessions_read_center on public.class_sessions;
drop policy if exists attendance_read_center on public.attendance;
drop policy if exists evaluations_read_center on public.student_session_evaluations;
drop policy if exists assignments_read_center on public.class_assignments;
drop policy if exists tuition_read_finance on public.tuition_ledgers;
drop policy if exists payment_read_finance on public.payments;
drop policy if exists finance_tx_read on public.financial_transactions;
drop policy if exists payroll_runs_read on public.payroll_runs;
drop policy if exists payroll_items_read on public.payroll_items;
drop policy if exists settings_admin_read on public.system_settings;
drop policy if exists audit_admin_read on public.audit_logs;
drop policy if exists classes_admin_insert on public.classes;
drop policy if exists classes_admin_update on public.classes;
drop policy if exists students_admin_insert on public.students;
drop policy if exists students_admin_update on public.students;

alter table public.fund_ledger enable row level security;
alter table public.profit_distributions enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_issues enable row level security;
alter table public.idempotency_requests enable row level security;

create policy centers_read on public.centers for select to authenticated
  using (id = public.current_center_id());
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or (public.is_admin() and center_id = public.current_center_id()));
create policy staff_read on public.staff for select to authenticated
  using (center_id = public.current_center_id() and
    (public.is_accountant() or id = public.current_staff_id()));
create policy classes_read on public.classes for select to authenticated
  using (center_id = public.current_center_id() and
    (public.is_accountant() or public.has_class_assignment(id)));
create policy periods_read on public.accounting_periods for select to authenticated
  using (center_id = public.current_center_id());
create policy students_read on public.students for select to authenticated
  using (center_id = public.current_center_id() and
    (public.is_accountant() or exists (
      select 1 from public.enrollments e
      where e.student_id = students.id and public.has_class_assignment(e.class_id)
        and e.status = 'ACTIVE')));
create policy class_schedules_read on public.class_schedules for select to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and public.has_class_assignment(c.id)));
create policy enrollments_read on public.enrollments for select to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = enrollments.class_id and c.center_id = public.current_center_id()
      and (public.is_accountant() or (enrollments.status = 'ACTIVE' and public.has_class_assignment(c.id)))
  ));
create policy sessions_read on public.class_sessions for select to authenticated
  using (public.has_class_assignment(class_id));
create policy attendance_read on public.attendance for select to authenticated
  using (exists (select 1 from public.class_sessions s where s.id = session_id and public.has_class_assignment(s.class_id)));
create policy evaluations_read on public.student_session_evaluations for select to authenticated
  using (exists (select 1 from public.class_sessions s where s.id = session_id and public.has_class_assignment(s.class_id)));
create policy assignments_read on public.class_assignments for select to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = class_assignments.class_id and c.center_id = public.current_center_id()
      and (public.is_accountant() or public.has_class_assignment(c.id))
  ));

create policy tuition_read on public.tuition_ledgers for select to authenticated
  using (public.is_accountant() and exists (
    select 1 from public.enrollments e join public.classes c on c.id=e.class_id
    where e.id=enrollment_id and c.center_id=public.current_center_id()));
create policy adjustment_read on public.tuition_adjustments for select to authenticated
  using (public.is_accountant() and exists (
    select 1 from public.enrollments e join public.classes c on c.id=e.class_id
    where e.id=enrollment_id and c.center_id=public.current_center_id()));
create policy payment_read on public.payments for select to authenticated
  using (public.is_accountant() and exists (
    select 1 from public.tuition_ledgers l join public.enrollments e on e.id=l.enrollment_id
    join public.classes c on c.id=e.class_id where l.id=tuition_ledger_id and c.center_id=public.current_center_id()));
create policy finance_tx_read on public.financial_transactions for select to authenticated
  using (public.is_accountant() and exists (select 1 from public.accounting_periods p where p.id=period_id and p.center_id=public.current_center_id()));
create policy rewards_read on public.student_rewards for select to authenticated
  using (public.is_accountant() and exists (select 1 from public.accounting_periods p where p.id=period_id and p.center_id=public.current_center_id()));
create policy payroll_policy_read on public.payroll_policies for select to authenticated
  using (public.is_accountant() and center_id=public.current_center_id());
create policy payroll_runs_read on public.payroll_runs for select to authenticated
  using (public.is_accountant() and exists (select 1 from public.accounting_periods p where p.id=period_id and p.center_id=public.current_center_id()));
create policy payroll_items_read on public.payroll_items for select to authenticated
  using (public.is_accountant() and exists (
    select 1 from public.payroll_runs r join public.accounting_periods p on p.id=r.period_id
    where r.id=payroll_run_id and p.center_id=public.current_center_id()));
create policy fund_read on public.fund_ledger for select to authenticated
  using (public.is_admin() and exists (select 1 from public.accounting_periods p where p.id=period_id and p.center_id=public.current_center_id()));
create policy profit_read on public.profit_distributions for select to authenticated
  using (public.is_admin() and exists (select 1 from public.accounting_periods p where p.id=period_id and p.center_id=public.current_center_id()));
create policy settings_read on public.system_settings for select to authenticated
  using (public.is_admin() and center_id=public.current_center_id());
create policy audit_read on public.audit_logs for select to authenticated
  using (public.is_admin() and center_id=public.current_center_id());
create policy import_read on public.import_jobs for select to authenticated
  using (public.is_admin() and center_id=public.current_center_id());
create policy import_issues_read on public.import_job_issues for select to authenticated
  using (public.is_admin() and exists (select 1 from public.import_jobs j where j.id=import_job_id and j.center_id=public.current_center_id()));

create policy classes_admin_insert on public.classes for insert to authenticated
  with check (public.is_admin() and center_id=public.current_center_id());
create policy classes_admin_update on public.classes for update to authenticated
  using (public.is_admin() and center_id=public.current_center_id())
  with check (public.is_admin() and center_id=public.current_center_id());
create policy students_admin_insert on public.students for insert to authenticated
  with check (public.is_admin() and center_id=public.current_center_id());
create policy students_admin_update on public.students for update to authenticated
  using (public.is_admin() and center_id=public.current_center_id())
  with check (public.is_admin() and center_id=public.current_center_id());
create policy schedules_admin_write on public.class_schedules for all to authenticated
  using (public.is_admin() and exists (select 1 from public.classes c where c.id=class_id and c.center_id=public.current_center_id()))
  with check (public.is_admin() and exists (select 1 from public.classes c where c.id=class_id and c.center_id=public.current_center_id()));
create policy enrollment_admin_write on public.enrollments for all to authenticated
  using (public.is_admin() and exists (select 1 from public.classes c where c.id=class_id and c.center_id=public.current_center_id()))
  with check (public.is_admin() and exists (select 1 from public.classes c join public.students s on s.center_id=c.center_id where c.id=class_id and s.id=student_id and c.center_id=public.current_center_id()));
create policy staff_admin_write on public.staff for all to authenticated
  using (public.is_admin() and center_id=public.current_center_id())
  with check (public.is_admin() and center_id=public.current_center_id());
create policy assignment_admin_write on public.class_assignments for all to authenticated
  using (public.is_admin() and exists (select 1 from public.classes c where c.id=class_id and c.center_id=public.current_center_id()))
  with check (public.is_admin() and exists (select 1 from public.classes c join public.staff s on s.center_id=c.center_id where c.id=class_id and s.id=staff_id and c.center_id=public.current_center_id()));

grant select on public.fund_ledger, public.profit_distributions, public.import_jobs, public.import_job_issues,
  public.tuition_adjustments, public.payroll_policies, public.student_rewards to authenticated;
grant insert, update, delete on public.class_schedules, public.enrollments, public.staff, public.class_assignments to authenticated;

-- Keep imports private. Supabase creates the storage schema before migrations.
insert into storage.buckets (id, name, public)
values ('center-imports', 'center-imports', false)
on conflict (id) do update set public = false;

drop policy if exists center_imports_admin_read on storage.objects;
drop policy if exists center_imports_admin_insert on storage.objects;
create policy center_imports_admin_read on storage.objects for select to authenticated
  using (bucket_id='center-imports' and public.is_admin() and (storage.foldername(name))[1] = public.current_center_id()::text);
create policy center_imports_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id='center-imports' and public.is_admin() and (storage.foldername(name))[1] = public.current_center_id()::text);

grant select, insert, update on public.import_jobs to authenticated;
grant select on public.idempotency_requests to authenticated;

commit;
