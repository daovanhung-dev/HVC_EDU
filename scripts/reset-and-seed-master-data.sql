-- One-off remote reset and master-data seed for HVC_EDU.
-- Run only after the minimal schema migration, against the linked project:
-- supabase db query --linked --project-ref ytixnjosaruvpnlvkesv --file scripts/reset-and-seed-master-data.sql
-- The /tmp/hvc-edu-data-backup-*.json backup is intentionally outside git.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create temporary table _preserved_admins on commit drop as
select p.user_id, p.center_id, p.full_name
from public.profiles p
join auth.users u on u.id = p.user_id
where p.role = 'ADMIN'::public.app_role and p.active;

do $$
begin
  if not exists (select 1 from public.centers where code = 'HC' and status = 'ACTIVE') then
    raise exception using message = 'RESET_ABORTED_CENTER_HC_NOT_FOUND';
  end if;
  if not exists (select 1 from _preserved_admins) then
    raise exception using message = 'RESET_ABORTED_NO_ADMIN_PROFILE';
  end if;
end;
$$;

-- Keep only the tenant and authenticated ADMIN profiles. All operational
-- records are cleared in FK order; soft-delete is used during normal UI use.
delete from public.attendance;
delete from public.student_evaluations;
delete from public.staff_attendance;
delete from public.class_sessions;
delete from public.class_assignments;
delete from public.enrollments;
delete from public.class_schedules;
delete from public.financial_transactions;
delete from public.audit_logs;
delete from public.students;
delete from public.classes;
delete from public.profiles where user_id not in (select user_id from _preserved_admins);
delete from public.staff;
delete from public.centers where code <> 'HC';
delete from auth.users where id not in (select user_id from _preserved_admins);

-- Storage is cleared by scripts/reset-and-seed-master-data.sh through the
-- Storage API before this transaction starts. Direct SQL deletion is blocked
-- by Supabase's storage protection trigger.

create temporary table _seed_classes (code text primary key, id uuid not null) on commit drop;
with inserted as (
  insert into public.classes (center_id, code, name, grade, subject, status)
  select c.id, x.code, x.name, x.grade, x.subject, 'ACTIVE'::public.entity_status
  from public.centers c
  cross join (values
    ('L06', 'Lớp 6 Thầy Cường', 6, 'Toán'),
    ('L07', 'Toán 7 Thầy Cường', 7, 'Toán'),
    ('L08', 'Toán 8 Thầy Cường', 8, 'Toán'),
    ('L09', 'Toán 9 Thầy Cường', 9, 'Toán')
  ) as x(code, name, grade, subject)
  where c.code = 'HC'
  returning id, code
)
insert into _seed_classes select code, id from inserted;

create temporary table _seed_staff (code text primary key, id uuid not null) on commit drop;
with inserted as (
  insert into public.staff (center_id, code, full_name, staff_type, status)
  select c.id, x.code, x.full_name, x.staff_type::public.staff_type, 'ACTIVE'::public.entity_status
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
insert into _seed_staff select code, id from inserted;

create temporary table _seed_students (code text primary key, id uuid not null, class_code text not null) on commit drop;
with inserted as (
  insert into public.students (center_id, code, full_name, status)
  select c.id, x.code, x.full_name, 'ACTIVE'::public.entity_status
  from public.centers c
  cross join (values
    ('HS06-001', 'Đào Thị Kim Ngân', 'L06'), ('HS06-002', 'Đặng Phương Anh', 'L06'),
    ('HS06-003', 'Nguyễn Gia Bảo', 'L06'), ('HS06-004', 'Nguyễn Đặng Gia Bảo', 'L06'),
    ('HS06-005', 'Tuệ Lâm', 'L06'), ('HS06-006', 'Đặng Khánh Linh', 'L06'),
    ('HS06-007', 'Nguyễn Ngọc Diệp', 'L06'), ('HS06-008', 'Nguyễn Ngọc Cẩm Tú', 'L06'),
    ('HS06-009', 'Đào Thế Hoàng', 'L06'), ('HS06-010', 'Đào Nguyễn Bình An', 'L06'),
    ('HS06-011', 'Nguyễn Trà My', 'L06'), ('HS06-012', 'Bảo Dũng', 'L06'),
    ('HS06-013', 'Đào Quang Minh', 'L06'), ('HS06-014', 'Duy', 'L06'),
    ('HS06-015', 'Phúc', 'L06'), ('HS06-016', 'Linh', 'L06'),
    ('HS06-017', 'Hân', 'L06'), ('HS06-018', 'Kiều Anh', 'L06'),
    ('HS07-001', 'Lê Ngọc Ánh', 'L07'), ('HS07-002', 'Nguyễn Thị Hồng Hạnh', 'L07'),
    ('HS07-003', 'Nguyễn Văn Phúc', 'L07'), ('HS07-004', 'Đào Thành Lê', 'L07'),
    ('HS07-005', 'Nguyễn Thành Công', 'L07'), ('HS07-006', 'Bùi Bảo Minh Anh', 'L07'),
    ('HS07-007', 'Cao Nhật Minh', 'L07'), ('HS07-008', 'Phạm Mạnh Hùng', 'L07'),
    ('HS07-009', 'Hiếu', 'L07'), ('HS07-010', 'Cẩm Tiên', 'L07'),
    ('HS07-011', 'Bảo An', 'L07'), ('HS07-012', 'Đăng', 'L07'),
    ('HS07-013', 'Lan', 'L07'),
    ('HS08-001', 'Minh Thư', 'L08'), ('HS08-002', 'Nguyễn Đình Phát', 'L08'),
    ('HS08-003', 'Đỗ Thị Mai Ngọc', 'L08'), ('HS08-004', 'Bùi Hiền Nhi', 'L08'),
    ('HS08-005', 'Nguyễn Đặng Gia Hân', 'L08'), ('HS08-006', 'Đào Ngọc Khánh', 'L08'),
    ('HS08-007', 'Nhân', 'L08'),
    ('HS09-001', 'Trường An', 'L09'), ('HS09-002', 'Như Quỳnh', 'L09'),
    ('HS09-003', 'Huy Đức', 'L09'), ('HS09-004', 'Anh Trọng', 'L09'),
    ('HS09-005', 'Nguyễn Gia Bảo', 'L09'), ('HS09-006', 'Phạm Đức Hùng', 'L09'),
    ('HS09-007', 'Quân', 'L09'), ('HS09-008', 'Châu', 'L09'),
    ('HS09-009', 'Phương Nhi', 'L09'), ('HS09-010', 'Lê Bảo Châm', 'L09'),
    ('HS09-011', 'Tuấn', 'L09'), ('HS09-012', 'Xuân Quỳnh', 'L09')
  ) as x(code, full_name, class_code)
  where c.code = 'HC'
  returning id, code
)
insert into _seed_students (code, id, class_code)
select i.code, i.id, x.class_code
from inserted i
join (values
  ('HS06-001', 'L06'), ('HS06-002', 'L06'), ('HS06-003', 'L06'), ('HS06-004', 'L06'), ('HS06-005', 'L06'), ('HS06-006', 'L06'), ('HS06-007', 'L06'), ('HS06-008', 'L06'), ('HS06-009', 'L06'), ('HS06-010', 'L06'), ('HS06-011', 'L06'), ('HS06-012', 'L06'), ('HS06-013', 'L06'), ('HS06-014', 'L06'), ('HS06-015', 'L06'), ('HS06-016', 'L06'), ('HS06-017', 'L06'), ('HS06-018', 'L06'),
  ('HS07-001', 'L07'), ('HS07-002', 'L07'), ('HS07-003', 'L07'), ('HS07-004', 'L07'), ('HS07-005', 'L07'), ('HS07-006', 'L07'), ('HS07-007', 'L07'), ('HS07-008', 'L07'), ('HS07-009', 'L07'), ('HS07-010', 'L07'), ('HS07-011', 'L07'), ('HS07-012', 'L07'), ('HS07-013', 'L07'),
  ('HS08-001', 'L08'), ('HS08-002', 'L08'), ('HS08-003', 'L08'), ('HS08-004', 'L08'), ('HS08-005', 'L08'), ('HS08-006', 'L08'), ('HS08-007', 'L08'),
  ('HS09-001', 'L09'), ('HS09-002', 'L09'), ('HS09-003', 'L09'), ('HS09-004', 'L09'), ('HS09-005', 'L09'), ('HS09-006', 'L09'), ('HS09-007', 'L09'), ('HS09-008', 'L09'), ('HS09-009', 'L09'), ('HS09-010', 'L09'), ('HS09-011', 'L09'), ('HS09-012', 'L09')
) as x(code, class_code) on x.code = i.code;

insert into public.enrollments (student_id, class_id, enrolled_from, status)
select s.id, c.id, date '2026-09-01', 'ACTIVE'
from _seed_students s join _seed_classes c on c.code = s.class_code;

insert into public.class_schedules (class_id, weekday, start_time, end_time, active)
select c.id, x.weekday, null::time, null::time, true
from _seed_classes c join (values
  ('L06', 4::smallint), ('L06', 7::smallint), ('L07', 2::smallint), ('L07', 5::smallint),
  ('L08', 2::smallint), ('L08', 7::smallint), ('L09', 1::smallint), ('L09', 4::smallint)
) as x(class_code, weekday) on x.class_code = c.code;

insert into public.class_assignments (class_id, staff_id, role, start_date, active)
select c.id, s.id, x.role::public.assignment_role, date '2026-09-01', true
from _seed_classes c
join (values
  ('L06', 'GV001', 'TEACHER'), ('L06', 'TG003', 'ASSISTANT'), ('L07', 'GV001', 'TEACHER'), ('L07', 'TG001', 'ASSISTANT'),
  ('L08', 'GV001', 'TEACHER'), ('L08', 'TG002', 'ASSISTANT'), ('L09', 'GV001', 'TEACHER'), ('L09', 'TG002', 'ASSISTANT')
) as x(class_code, staff_code, role) on x.class_code = c.code
join _seed_staff s on s.code = x.staff_code;

do $$
declare
  expected record;
begin
  if (select count(*) from public.classes) <> 4 or (select count(*) from public.students) <> 50
    or (select count(*) from public.enrollments) <> 50 or (select count(*) from public.staff) <> 5
    or (select count(*) from public.class_schedules) <> 8 or (select count(*) from public.class_assignments) <> 8 then
    raise exception using message = 'RESET_ABORTED_SEED_COUNT_MISMATCH';
  end if;
  for expected in select * from (values ('L06', 18), ('L07', 13), ('L08', 7), ('L09', 12)) as x(code, amount) loop
    if (select count(*) from public.enrollments e join public.classes c on c.id = e.class_id where c.code = expected.code and e.status = 'ACTIVE') <> expected.amount then
      raise exception using message = 'RESET_ABORTED_ROSTER_COUNT_MISMATCH';
    end if;
  end loop;
  if exists (select 1 from public.class_sessions) or exists (select 1 from public.attendance)
    or exists (select 1 from public.student_evaluations) or exists (select 1 from public.staff_attendance)
    or exists (select 1 from public.financial_transactions) then
    raise exception using message = 'RESET_ABORTED_OPERATIONAL_DATA_NOT_EMPTY';
  end if;
end;
$$;

insert into public.audit_logs (center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
select c.id, a.user_id, 'MASTER_DATA_RESET', 'center', c.id,
  jsonb_build_object('preserved_admin_count', (select count(*) from _preserved_admins)), 'master-reset-' || gen_random_uuid()::text
from public.centers c cross join lateral (select user_id from _preserved_admins order by user_id limit 1) a where c.code = 'HC';

insert into public.audit_logs (center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
select c.id, a.user_id, 'MASTER_DATA_SEEDED', 'center', c.id,
  jsonb_build_object('source', 'docs/fill_data/Nguon_Data_Van_Hanh_TrungTam_HungCuong.md', 'effective_from', '2026-09-01', 'classes', 4, 'students', 50, 'enrollments', 50, 'staff', 5, 'schedules', 8, 'assignments', 8), 'master-seed-' || gen_random_uuid()::text
from public.centers c cross join lateral (select user_id from _preserved_admins order by user_id limit 1) a where c.code = 'HC';

commit;
