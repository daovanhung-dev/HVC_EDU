-- One-off remote reset and master-data seed for HVC_EDU.
-- Run only against the intended Supabase project with:
--   supabase db query --linked --project-ref ytixnjosaruvpnlvkesv --file scripts/reset-and-seed-master-data.sql
--
-- This deliberately does not create a migration. It preserves every ADMIN
-- profile/auth user, the HC tenant row, and writes fresh reset/seed audit rows.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '120s';

create temporary table _preserved_admins on commit drop as
select p.user_id, p.center_id
from public.profiles p
join auth.users u on u.id = p.user_id
where p.role = 'ADMIN'::public.app_role;

create temporary table _preserved_centers on commit drop as
select c.id
from public.centers c
where c.code = 'HC'
   or c.id in (select pa.center_id from _preserved_admins pa);

do $$
begin
  if not exists (select 1 from public.centers where code = 'HC') then
    raise exception using message = 'RESET_ABORTED_CENTER_HC_NOT_FOUND';
  end if;

  if not exists (select 1 from _preserved_admins) then
    raise exception using message = 'RESET_ABORTED_NO_ADMIN_PROFILE';
  end if;
end;
$$;

-- Remove all application data in dependency order. The schema, functions,
-- storage bucket definition, ADMIN profiles, and required tenant rows remain.
delete from public.notifications;
delete from public.staff_work_attendance;
delete from public.staff_availability;
delete from public.attendance;
delete from public.student_session_evaluations;
delete from public.payments;
delete from public.tuition_adjustments;
delete from public.tuition_ledgers;
delete from public.payroll_items;
delete from public.payroll_runs;
delete from public.period_class_configs;
delete from public.period_settings;
delete from public.class_sessions;
delete from public.class_assignments;
delete from public.financial_transactions;
delete from public.student_rewards;
delete from public.fund_ledger;
delete from public.profit_distributions;
delete from public.import_job_issues;
delete from public.import_jobs;
delete from public.idempotency_requests;
delete from public.system_settings;
delete from public.payroll_policies;
delete from public.audit_logs;
delete from public.enrollments;
delete from public.students;
delete from public.class_schedules;
delete from public.classes;
delete from public.accounting_periods;
delete from public.profiles
where user_id not in (select user_id from _preserved_admins);
delete from public.staff;
delete from public.centers
where id not in (select id from _preserved_centers);

-- auth.users owns identities/sessions through Supabase-managed cascades. All
-- public foreign keys to non-admin users were removed above.
delete from auth.users
where id not in (select user_id from _preserved_admins);

create temporary table _seed_classes (
  code text primary key,
  id uuid not null
) on commit drop;

with inserted as (
  insert into public.classes (
    center_id, code, name, grade, subject, standard_unit_fee,
    collection_method, status
  )
  select c.id, x.code, x.name, x.grade, x.subject, x.standard_unit_fee,
         x.collection_method::public.collection_method, 'ACTIVE'::public.entity_status
  from public.centers c
  cross join (values
    ('L06', 'Lớp 6 Thầy Cường', 6, 'Toán', 50000::bigint, 'PER_SESSION'),
    ('L07', 'Toán 7 Thầy Cường', 7, 'Toán', 50000::bigint, 'PER_SESSION'),
    ('L08', 'Toán 8 Thầy Cường', 8, 'Toán', 50000::bigint, 'PER_SESSION'),
    ('L09', 'Toán 9 Thầy Cường', 9, 'Toán', 60000::bigint, 'PREPAID')
  ) as x(code, name, grade, subject, standard_unit_fee, collection_method)
  where c.code = 'HC'
  returning id, code
)
insert into _seed_classes(code, id)
select code, id from inserted;

create temporary table _seed_staff (
  code text primary key,
  id uuid not null
) on commit drop;

with inserted as (
  insert into public.staff (
    center_id, code, full_name, staff_type, primary_subject, status
  )
  select c.id, x.code, x.full_name, x.staff_type::public.staff_type,
         'Toán', 'ACTIVE'::public.entity_status
  from public.centers c
  cross join (values
    ('GV001', 'Nguyễn Mạnh Cường', 'TEACHER'),
    ('GV002', 'Nguyễn Thị Huệ', 'TEACHER'),
    ('TG001', 'Đào Quang Duy', 'ASSISTANT'),
    ('TG002', 'Đào Phương Anh', 'ASSISTANT'),
    ('TG003', 'Nguyễn Hà Anh', 'ASSISTANT')
  ) as x(code, full_name, staff_type)
  where c.code = 'HC'
  returning id, code
)
insert into _seed_staff(code, id)
select code, id from inserted;

create temporary table _seed_students (
  code text primary key,
  id uuid not null,
  class_code text not null
) on commit drop;

with inserted as (
  insert into public.students (center_id, code, full_name, status)
  select c.id, x.code, x.full_name, 'ACTIVE'::public.entity_status
  from public.centers c
  cross join (values
    ('HS06-001', 'Đào Thị Kim Ngân', 'L06'),
    ('HS06-002', 'Đặng Phương Anh', 'L06'),
    ('HS06-003', 'Nguyễn Gia Bảo', 'L06'),
    ('HS06-004', 'Nguyễn Đặng Gia Bảo', 'L06'),
    ('HS06-005', 'Tuệ Lâm', 'L06'),
    ('HS06-006', 'Đặng Khánh Linh', 'L06'),
    ('HS06-007', 'Nguyễn Ngọc Diệp', 'L06'),
    ('HS06-008', 'Nguyễn Ngọc Cẩm Tú', 'L06'),
    ('HS06-009', 'Đào Thế Hoàng', 'L06'),
    ('HS06-010', 'Đào Nguyễn Bình An', 'L06'),
    ('HS06-011', 'Nguyễn Trà My', 'L06'),
    ('HS06-012', 'Bảo Dũng', 'L06'),
    ('HS06-013', 'Đào Quang Minh', 'L06'),
    ('HS06-014', 'Duy', 'L06'),
    ('HS06-015', 'Phúc', 'L06'),
    ('HS06-016', 'Linh', 'L06'),
    ('HS06-017', 'Hân', 'L06'),
    ('HS06-018', 'Kiều Anh', 'L06'),
    ('HS07-001', 'Lê Ngọc Ánh', 'L07'),
    ('HS07-002', 'Nguyễn Thị Hồng Hạnh', 'L07'),
    ('HS07-003', 'Nguyễn Văn Phúc', 'L07'),
    ('HS07-004', 'Đào Thành Lê', 'L07'),
    ('HS07-005', 'Nguyễn Thành Công', 'L07'),
    ('HS07-006', 'Bùi Bảo Minh Anh', 'L07'),
    ('HS07-007', 'Cao Nhật Minh', 'L07'),
    ('HS07-008', 'Phạm Mạnh Hùng', 'L07'),
    ('HS07-009', 'Hiếu', 'L07'),
    ('HS07-010', 'Cẩm Tiên', 'L07'),
    ('HS07-011', 'Bảo An', 'L07'),
    ('HS07-012', 'Đăng', 'L07'),
    ('HS07-013', 'Lan', 'L07'),
    ('HS08-001', 'Minh Thư', 'L08'),
    ('HS08-002', 'Nguyễn Đình Phát', 'L08'),
    ('HS08-003', 'Đỗ Thị Mai Ngọc', 'L08'),
    ('HS08-004', 'Bùi Hiền Nhi', 'L08'),
    ('HS08-005', 'Nguyễn Đặng Gia Hân', 'L08'),
    ('HS08-006', 'Đào Ngọc Khánh', 'L08'),
    ('HS08-007', 'Nhân', 'L08'),
    ('HS09-001', 'Trường An', 'L09'),
    ('HS09-002', 'Như Quỳnh', 'L09'),
    ('HS09-003', 'Huy Đức', 'L09'),
    ('HS09-004', 'Anh Trọng', 'L09'),
    ('HS09-005', 'Nguyễn Gia Bảo', 'L09'),
    ('HS09-006', 'Phạm Đức Hùng', 'L09'),
    ('HS09-007', 'Quân', 'L09'),
    ('HS09-008', 'Châu', 'L09'),
    ('HS09-009', 'Phương Nhi', 'L09'),
    ('HS09-010', 'Lê Bảo Châm', 'L09'),
    ('HS09-011', 'Tuấn', 'L09'),
    ('HS09-012', 'Xuân Quỳnh', 'L09')
  ) as x(code, full_name, class_code)
  where c.code = 'HC'
  returning id, code
)
insert into _seed_students(code, id, class_code)
select i.code, i.id, x.class_code
from inserted i
join (values
  ('HS06-001', 'L06'), ('HS06-002', 'L06'), ('HS06-003', 'L06'),
  ('HS06-004', 'L06'), ('HS06-005', 'L06'), ('HS06-006', 'L06'),
  ('HS06-007', 'L06'), ('HS06-008', 'L06'), ('HS06-009', 'L06'),
  ('HS06-010', 'L06'), ('HS06-011', 'L06'), ('HS06-012', 'L06'),
  ('HS06-013', 'L06'), ('HS06-014', 'L06'), ('HS06-015', 'L06'),
  ('HS06-016', 'L06'), ('HS06-017', 'L06'), ('HS06-018', 'L06'),
  ('HS07-001', 'L07'), ('HS07-002', 'L07'), ('HS07-003', 'L07'),
  ('HS07-004', 'L07'), ('HS07-005', 'L07'), ('HS07-006', 'L07'),
  ('HS07-007', 'L07'), ('HS07-008', 'L07'), ('HS07-009', 'L07'),
  ('HS07-010', 'L07'), ('HS07-011', 'L07'), ('HS07-012', 'L07'),
  ('HS07-013', 'L07'), ('HS08-001', 'L08'), ('HS08-002', 'L08'),
  ('HS08-003', 'L08'), ('HS08-004', 'L08'), ('HS08-005', 'L08'),
  ('HS08-006', 'L08'), ('HS08-007', 'L08'), ('HS09-001', 'L09'),
  ('HS09-002', 'L09'), ('HS09-003', 'L09'), ('HS09-004', 'L09'),
  ('HS09-005', 'L09'), ('HS09-006', 'L09'), ('HS09-007', 'L09'),
  ('HS09-008', 'L09'), ('HS09-009', 'L09'), ('HS09-010', 'L09'),
  ('HS09-011', 'L09'), ('HS09-012', 'L09')
) as x(code, class_code) on x.code = i.code;

insert into public.enrollments (student_id, class_id, enrolled_from, status)
select s.id, c.id, date '2026-09-01', 'ACTIVE'
from _seed_students s
join _seed_classes c on c.code = s.class_code;

insert into public.class_schedules (
  class_id, weekday, start_time, end_time, effective_from, active
)
select c.id, x.weekday, null::time, null::time, date '2026-09-01', true
from _seed_classes c
join (values
  ('L06', 4::smallint), ('L06', 7::smallint),
  ('L07', 2::smallint), ('L07', 5::smallint),
  ('L08', 2::smallint), ('L08', 7::smallint),
  ('L09', 1::smallint), ('L09', 4::smallint)
) as x(class_code, weekday) on x.class_code = c.code;

insert into public.class_assignments (
  class_id, staff_id, period_id, role, planned_sessions, start_date
)
select c.id, s.id, null, x.role::public.assignment_role, null, date '2026-09-01'
from _seed_classes c
join (values
  ('L06', 'GV001', 'MAIN_TEACHER'), ('L06', 'TG003', 'ASSISTANT'),
  ('L07', 'GV001', 'MAIN_TEACHER'), ('L07', 'TG001', 'ASSISTANT'),
  ('L08', 'GV001', 'MAIN_TEACHER'), ('L08', 'TG002', 'ASSISTANT'),
  ('L09', 'GV001', 'MAIN_TEACHER'), ('L09', 'TG002', 'ASSISTANT')
) as x(class_code, staff_code, role) on x.class_code = c.code
join _seed_staff s on s.code = x.staff_code;

do $$
declare
  v_class_count int;
  v_student_count int;
  v_enrollment_count int;
  v_staff_count int;
  v_schedule_count int;
  v_assignment_count int;
begin
  select count(*) into v_class_count from public.classes;
  select count(*) into v_student_count from public.students;
  select count(*) into v_enrollment_count from public.enrollments;
  select count(*) into v_staff_count from public.staff;
  select count(*) into v_schedule_count from public.class_schedules;
  select count(*) into v_assignment_count from public.class_assignments;

  if v_class_count <> 4 or v_student_count <> 50 or v_enrollment_count <> 50
     or v_staff_count <> 5 or v_schedule_count <> 8 or v_assignment_count <> 8 then
    raise exception using message = 'RESET_ABORTED_SEED_COUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from (values ('L06', 18::bigint), ('L07', 13::bigint),
                 ('L08', 7::bigint), ('L09', 12::bigint)) as expected(code, expected_count)
    left join (
      select c.code, count(e.id)::bigint as actual_count
      from public.classes c
      left join public.enrollments e on e.class_id = c.id
      group by c.code
    ) actual on actual.code = expected.code
    where coalesce(actual.actual_count, 0) <> expected.expected_count
  ) then
    raise exception using message = 'RESET_ABORTED_ROSTER_COUNT_MISMATCH';
  end if;
end;
$$;

insert into public.audit_logs (
  center_id, actor_user_id, action, resource_type, resource_id,
  after_data, trace_id
)
select c.id, a.user_id, 'MASTER_DATA_RESET', 'center', c.id::text,
       jsonb_build_object('preserved_admin_count', (select count(*) from _preserved_admins)),
       'master-data-reset-' || gen_random_uuid()::text
from public.centers c
cross join lateral (select user_id from _preserved_admins order by user_id limit 1) a
where c.code = 'HC';

insert into public.audit_logs (
  center_id, actor_user_id, action, resource_type, resource_id,
  after_data, trace_id
)
select c.id, a.user_id, 'MASTER_DATA_SEEDED', 'center', c.id::text,
       jsonb_build_object(
         'source', 'docs/fill_data/Nguon_Data_Van_Hanh_TrungTam_HungCuong.md',
         'effective_from', '2026-09-01',
         'classes', 4, 'students', 50, 'staff', 5,
         'schedules', 8, 'assignments', 8, 'enrollments', 50
       ),
       'master-data-seed-' || gen_random_uuid()::text
from public.centers c
cross join lateral (select user_id from _preserved_admins order by user_id limit 1) a
where c.code = 'HC';

commit;
