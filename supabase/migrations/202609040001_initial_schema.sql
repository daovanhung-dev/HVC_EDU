begin;

create extension if not exists pgcrypto;

create type public.app_role as enum ('ADMIN','ACCOUNTANT','TEACHER','ASSISTANT');
create type public.entity_status as enum ('ACTIVE','INACTIVE');
create type public.period_status as enum ('OPEN','CLOSING','CLOSED');
create type public.collection_method as enum ('PER_SESSION','PREPAID');
create type public.session_status as enum ('SCHEDULED','COMPLETED','CANCELLED');
create type public.attendance_status as enum ('PRESENT','ABSENT','EXCUSED');
create type public.staff_type as enum ('TEACHER','ASSISTANT');
create type public.assignment_role as enum ('MAIN_TEACHER','ASSISTANT');
create type public.ledger_status as enum ('DRAFT','CONFIRMED','PAID','PARTIAL','UNPAID');
create type public.payment_method as enum ('CASH','BANK_TRANSFER','OTHER');
create type public.financial_transaction_type as enum ('INCOME','EXPENSE');
create type public.payroll_status as enum ('DRAFT','APPROVED','PAID');

create table public.centers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status public.entity_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  code text not null,
  full_name text not null,
  staff_type public.staff_type not null,
  phone text,
  primary_subject text,
  status public.entity_status not null default 'ACTIVE',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(center_id, code)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  center_id uuid not null references public.centers(id) on delete restrict,
  full_name text not null,
  role public.app_role not null,
  staff_id uuid references public.staff(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  start_date date not null,
  end_date date not null,
  status public.period_status not null default 'OPEN',
  closed_at timestamptz,
  closed_by uuid references auth.users(id),
  version bigint not null default 1 check(version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(center_id, year, month),
  check(end_date >= start_date)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  code text not null,
  name text not null,
  grade smallint not null check(grade between 1 and 12),
  subject text not null,
  standard_unit_fee bigint not null default 0 check(standard_unit_fee >= 0),
  collection_method public.collection_method not null default 'PER_SESSION',
  status public.entity_status not null default 'ACTIVE',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(center_id, code)
);

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  weekday smallint not null check(weekday between 1 and 7),
  start_time time,
  end_time time,
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check(effective_to is null or effective_to >= effective_from),
  check(end_time is null or start_time is null or end_time > start_time)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  code text not null,
  full_name text not null,
  phone text,
  parent_name text,
  parent_phone text,
  status public.entity_status not null default 'ACTIVE',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(center_id, code)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  enrolled_from date not null,
  enrolled_to date,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','LEFT')),
  unit_price_override bigint check(unit_price_override is null or unit_price_override >= 0),
  tuition_exempt boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(enrolled_to is null or enrolled_to >= enrolled_from)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  session_date date not null,
  start_time time,
  end_time time,
  status public.session_status not null default 'SCHEDULED',
  teacher_id uuid references public.staff(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, session_date, start_time)
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  status public.attendance_status not null,
  note text,
  marked_by uuid not null references auth.users(id),
  marked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, enrollment_id)
);

create table public.student_session_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  homework_score numeric(4,2) check(homework_score is null or homework_score between 0 and 10),
  understanding_score numeric(4,2) check(understanding_score is null or understanding_score between 0 and 10),
  attitude_score numeric(4,2) check(attitude_score is null or attitude_score between 0 and 10),
  learning_gap text,
  comment text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, enrollment_id)
);

create table public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  period_id uuid references public.accounting_periods(id) on delete restrict,
  role public.assignment_role not null,
  planned_sessions int check(planned_sessions is null or planned_sessions >= 0),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  check(end_date is null or end_date >= start_date)
);

create table public.tuition_ledgers (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  attended_sessions int not null default 0 check(attended_sessions >= 0),
  absent_sessions int not null default 0 check(absent_sessions >= 0),
  billable_sessions int not null default 0 check(billable_sessions >= 0),
  unit_price bigint not null default 0 check(unit_price >= 0),
  gross_amount bigint not null default 0,
  opening_debt bigint not null default 0,
  adjustment_amount bigint not null default 0,
  amount_due bigint not null default 0,
  paid_amount bigint not null default 0,
  debt_amount bigint not null default 0,
  status public.ledger_status not null default 'DRAFT',
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(period_id, enrollment_id)
);

create table public.tuition_adjustments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  type text not null check(type in ('DISCOUNT','CARRY_IN','CARRY_OUT','OPENING_DEBT','MANUAL')),
  amount bigint not null,
  reason text not null,
  source_period_id uuid references public.accounting_periods(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tuition_ledger_id uuid not null references public.tuition_ledgers(id) on delete restrict,
  amount bigint not null check(amount > 0),
  paid_at timestamptz not null,
  method public.payment_method not null,
  reference text,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id)
);

create table public.student_rewards (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  amount bigint not null check(amount >= 0),
  reason text not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  transaction_date date not null,
  type public.financial_transaction_type not null,
  category text not null,
  class_id uuid references public.classes(id) on delete restrict,
  description text not null,
  amount bigint not null check(amount > 0),
  attachment_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz
);

create table public.payroll_policies (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  name text not null,
  teacher_percent numeric(7,4) not null default 0.25 check(teacher_percent between 0 and 1),
  assistant_percent numeric(7,4) not null default 0.15 check(assistant_percent between 0 and 1),
  max_total_percent numeric(7,4) not null default 0.40 check(max_total_percent between 0 and 1),
  rounding_step bigint not null default 50000 check(rounding_step > 0),
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check(teacher_percent + assistant_percent <= max_total_percent),
  check(effective_to is null or effective_to >= effective_from)
);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null unique references public.accounting_periods(id) on delete restrict,
  status public.payroll_status not null default 'DRAFT',
  total_amount bigint not null default 0,
  calculated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  version bigint not null default 1 check(version >= 1)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete restrict,
  staff_id uuid not null references public.staff(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  role public.assignment_role not null,
  class_revenue bigint not null default 0,
  sessions_taught int not null default 0,
  applied_percent numeric(7,4) not null default 0,
  base_amount bigint not null default 0,
  bonus bigint not null default 0,
  penalty bigint not null default 0,
  final_amount bigint not null default 0,
  unique(payroll_run_id, staff_id, class_id, role)
);

create table public.system_settings (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(center_id, key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  actor_user_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  trace_id text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

-- Helper functions centralize tenant/role checks. SECURITY DEFINER functions lock search_path.
create or replace function public.current_center_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.center_id from public.profiles p where p.user_id = auth.uid() and p.active = true limit 1;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = auth.uid() and p.active = true limit 1;
$$;

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.staff_id from public.profiles p where p.user_id = auth.uid() and p.active = true limit 1;
$$;

revoke all on function public.current_center_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_staff_id() from public;
grant execute on function public.current_center_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_staff_id() to authenticated;

-- Enable RLS everywhere exposed to Data API.
alter table public.centers enable row level security;
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.classes enable row level security;
alter table public.class_schedules enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.student_session_evaluations enable row level security;
alter table public.class_assignments enable row level security;
alter table public.tuition_ledgers enable row level security;
alter table public.tuition_adjustments enable row level security;
alter table public.payments enable row level security;
alter table public.student_rewards enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.payroll_policies enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy centers_read on public.centers for select to authenticated using (id = public.current_center_id());
create policy profiles_read_self on public.profiles for select to authenticated using (user_id = auth.uid());

create policy staff_read_center on public.staff for select to authenticated using (center_id = public.current_center_id());
create policy classes_read_center on public.classes for select to authenticated using (center_id = public.current_center_id());
create policy periods_read_center on public.accounting_periods for select to authenticated using (center_id = public.current_center_id());
create policy students_read_center on public.students for select to authenticated using (center_id = public.current_center_id());

create policy class_schedules_read_center on public.class_schedules for select to authenticated using (
  exists(select 1 from public.classes c where c.id = class_id and c.center_id = public.current_center_id())
);
create policy enrollments_read_center on public.enrollments for select to authenticated using (
  exists(select 1 from public.classes c where c.id = class_id and c.center_id = public.current_center_id())
);
create policy sessions_read_center on public.class_sessions for select to authenticated using (
  exists(select 1 from public.classes c where c.id = class_id and c.center_id = public.current_center_id())
);
create policy attendance_read_center on public.attendance for select to authenticated using (
  exists(select 1 from public.class_sessions s join public.classes c on c.id=s.class_id where s.id=session_id and c.center_id=public.current_center_id())
);
create policy evaluations_read_center on public.student_session_evaluations for select to authenticated using (
  exists(select 1 from public.class_sessions s join public.classes c on c.id=s.class_id where s.id=session_id and c.center_id=public.current_center_id())
);
create policy assignments_read_center on public.class_assignments for select to authenticated using (
  exists(select 1 from public.classes c where c.id=class_id and c.center_id=public.current_center_id())
);

-- Finance is read-only from browser for Admin/Accountant; writes go through Edge Functions.
create policy tuition_read_finance on public.tuition_ledgers for select to authenticated using (
  public.current_app_role() in ('ADMIN','ACCOUNTANT') and
  exists(select 1 from public.enrollments e join public.classes c on c.id=e.class_id where e.id=enrollment_id and c.center_id=public.current_center_id())
);
create policy payment_read_finance on public.payments for select to authenticated using (
  public.current_app_role() in ('ADMIN','ACCOUNTANT') and
  exists(select 1 from public.tuition_ledgers tl join public.enrollments e on e.id=tl.enrollment_id join public.classes c on c.id=e.class_id where tl.id=tuition_ledger_id and c.center_id=public.current_center_id())
);
create policy finance_tx_read on public.financial_transactions for select to authenticated using (
  public.current_app_role() in ('ADMIN','ACCOUNTANT') and
  exists(select 1 from public.accounting_periods p where p.id=period_id and p.center_id=public.current_center_id())
);
create policy payroll_runs_read on public.payroll_runs for select to authenticated using (
  public.current_app_role() in ('ADMIN','ACCOUNTANT') and
  exists(select 1 from public.accounting_periods p where p.id=period_id and p.center_id=public.current_center_id())
);
create policy payroll_items_read on public.payroll_items for select to authenticated using (
  public.current_app_role() in ('ADMIN','ACCOUNTANT') and
  exists(select 1 from public.payroll_runs pr join public.accounting_periods p on p.id=pr.period_id where pr.id=payroll_run_id and p.center_id=public.current_center_id())
);
create policy settings_admin_read on public.system_settings for select to authenticated using (
  public.current_app_role()='ADMIN' and center_id=public.current_center_id()
);
create policy audit_admin_read on public.audit_logs for select to authenticated using (
  public.current_app_role()='ADMIN' and center_id=public.current_center_id()
);

-- Direct write policies for non-financial master data, intentionally narrow.
create policy classes_admin_insert on public.classes for insert to authenticated with check (public.current_app_role()='ADMIN' and center_id=public.current_center_id());
create policy classes_admin_update on public.classes for update to authenticated using (public.current_app_role()='ADMIN' and center_id=public.current_center_id()) with check (center_id=public.current_center_id());
create policy students_admin_insert on public.students for insert to authenticated with check (public.current_app_role()='ADMIN' and center_id=public.current_center_id());
create policy students_admin_update on public.students for update to authenticated using (public.current_app_role()='ADMIN' and center_id=public.current_center_id()) with check (center_id=public.current_center_id());

-- Grants: RLS remains the authority.
grant usage on schema public to authenticated;
grant select on public.centers, public.profiles, public.staff, public.accounting_periods, public.classes, public.class_schedules, public.students, public.enrollments, public.class_sessions, public.attendance, public.student_session_evaluations, public.class_assignments, public.tuition_ledgers, public.payments, public.financial_transactions, public.payroll_runs, public.payroll_items, public.system_settings, public.audit_logs to authenticated;
grant insert, update on public.classes, public.students to authenticated;

-- Seed one center and a default configurable payroll policy. User/profile creation is manual after Auth user exists.
insert into public.centers(code,name) values ('HC','Trung tâm Hùng Cường') on conflict(code) do nothing;
insert into public.payroll_policies(center_id,name,teacher_percent,assistant_percent,max_total_percent,rounding_step,effective_from)
select id,'Chính sách mặc định 25/15',0.25,0.15,0.40,50000,date '2026-09-01' from public.centers where code='HC'
and not exists(select 1 from public.payroll_policies where name='Chính sách mặc định 25/15');

commit;
