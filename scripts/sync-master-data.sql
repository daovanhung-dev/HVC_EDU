-- Safe, non-destructive sync for docs/fill_data/Nguon_Data_Van_Hanh_TrungTam_HungCuong.md.
-- The caller may replace the final COMMIT with ROLLBACK for a dry-run.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('hvc-edu-master-data-sync', 0));

create temporary table _sync_context on commit drop as
select c.id as center_id,
       (select p.user_id from public.profiles p where p.center_id = c.id and p.role = 'ADMIN'::public.app_role and p.active order by p.user_id limit 1) as admin_user_id
from public.centers c
where c.code = 'HC' and c.status = 'ACTIVE';

do $$
begin
  if not exists (select 1 from _sync_context) then
    raise exception using message = 'SYNC_ABORTED_CENTER_HC_NOT_FOUND';
  end if;
  if not exists (select 1 from _sync_context where admin_user_id is not null) then
    raise exception using message = 'SYNC_ABORTED_NO_ADMIN_PROFILE';
  end if;
end;
$$;

create temporary table _sync_classes (
  code text primary key,
  name text not null,
  grade smallint not null,
  subject text not null
) on commit drop;
insert into _sync_classes(code, name, grade, subject) values
  ('L06', 'Lớp 6 Thầy Cường', 6, 'Toán'),
  ('L07', 'Toán 7 Thầy Cường', 7, 'Toán'),
  ('L08', 'Toán 8 Thầy Cường', 8, 'Toán'),
  ('L09', 'Toán 9 Thầy Cường', 9, 'Toán');

create temporary table _sync_staff (
  code text primary key,
  full_name text not null,
  staff_type public.staff_type not null
) on commit drop;
insert into _sync_staff(code, full_name, staff_type) values
  ('GV001', 'Nguyễn Mạnh Cường', 'TEACHER'),
  ('GV002', 'Nguyễn Thị Huệ', 'TEACHER'),
  ('TG001', 'Đào Quang Duy', 'ASSISTANT'),
  ('TG002', 'Đào Phương Anh', 'ASSISTANT'),
  ('TG003', 'Nguyễn Hà Anh', 'ASSISTANT');

create temporary table _sync_students (
  code text primary key,
  full_name text not null,
  class_code text not null references _sync_classes(code)
) on commit drop;
insert into _sync_students(code, full_name, class_code) values
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
  ('HS09-011', 'Tuấn', 'L09'), ('HS09-012', 'Xuân Quỳnh', 'L09');

create temporary table _sync_schedules (
  class_code text not null references _sync_classes(code),
  weekday smallint not null check (weekday between 1 and 7),
  primary key (class_code, weekday)
) on commit drop;
insert into _sync_schedules(class_code, weekday) values
  ('L06', 4), ('L06', 7), ('L07', 2), ('L07', 5),
  ('L08', 2), ('L08', 7), ('L09', 1), ('L09', 4);

create temporary table _sync_assignments (
  class_code text not null references _sync_classes(code),
  staff_code text not null references _sync_staff(code),
  role public.assignment_role not null,
  primary key (class_code, staff_code, role)
) on commit drop;
insert into _sync_assignments(class_code, staff_code, role) values
  ('L06', 'GV001', 'TEACHER'), ('L06', 'TG003', 'ASSISTANT'),
  ('L07', 'GV001', 'TEACHER'), ('L07', 'TG001', 'ASSISTANT'),
  ('L08', 'GV001', 'TEACHER'), ('L08', 'TG002', 'ASSISTANT'),
  ('L09', 'GV001', 'TEACHER'), ('L09', 'TG002', 'ASSISTANT');

do $$
begin
  if (select count(*) from _sync_classes) <> 4
     or (select count(*) from _sync_staff) <> 5
     or (select count(*) from _sync_students) <> 50
     or (select count(*) from _sync_schedules) <> 8
     or (select count(*) from _sync_assignments) <> 8 then
    raise exception using message = 'SYNC_ABORTED_SOURCE_COUNT_MISMATCH';
  end if;
end;
$$;

create temporary table _sync_stats (
  entity text primary key,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  conflict_count integer not null default 0
) on commit drop;
insert into _sync_stats(entity) values
  ('classes'), ('staff'), ('students'), ('enrollments'), ('schedules'), ('assignments');

-- Classes: source fields are authoritative; absent note is preserved.
update _sync_stats s
set inserted_count = (
      select count(*) from _sync_classes x
      cross join _sync_context ctx
      where not exists (select 1 from public.classes c where c.center_id = ctx.center_id and c.code = x.code)
    ),
    updated_count = (
      select count(*) from _sync_classes x
      cross join _sync_context ctx
      join public.classes c on c.center_id = ctx.center_id and c.code = x.code
      where c.name is distinct from x.name or c.grade is distinct from x.grade
         or c.subject is distinct from x.subject or c.status is distinct from 'ACTIVE'::public.entity_status
    )
where s.entity = 'classes';

update public.classes c
set name = x.name, grade = x.grade, subject = x.subject, status = 'ACTIVE'::public.entity_status
from _sync_classes x, _sync_context ctx
where c.center_id = ctx.center_id and c.code = x.code;

insert into public.classes(center_id, code, name, grade, subject, status)
select ctx.center_id, x.code, x.name, x.grade, x.subject, 'ACTIVE'::public.entity_status
from _sync_classes x cross join _sync_context ctx
where not exists (select 1 from public.classes c where c.center_id = ctx.center_id and c.code = x.code);

-- Staff: source identity/type/status are authoritative; absent contact fields are preserved.
update _sync_stats s
set inserted_count = (
      select count(*) from _sync_staff x
      cross join _sync_context ctx
      where not exists (select 1 from public.staff p where p.center_id = ctx.center_id and p.code = x.code)
    ),
    updated_count = (
      select count(*) from _sync_staff x
      cross join _sync_context ctx
      join public.staff p on p.center_id = ctx.center_id and p.code = x.code
      where p.full_name is distinct from x.full_name or p.staff_type is distinct from x.staff_type
         or p.status is distinct from 'ACTIVE'::public.entity_status
    )
where s.entity = 'staff';

update public.staff p
set full_name = x.full_name, staff_type = x.staff_type, status = 'ACTIVE'::public.entity_status
from _sync_staff x, _sync_context ctx
where p.center_id = ctx.center_id and p.code = x.code;

insert into public.staff(center_id, code, full_name, staff_type, status)
select ctx.center_id, x.code, x.full_name, x.staff_type, 'ACTIVE'::public.entity_status
from _sync_staff x cross join _sync_context ctx
where not exists (select 1 from public.staff p where p.center_id = ctx.center_id and p.code = x.code);

-- Students: source code/name/status are authoritative; contacts and notes are preserved.
update _sync_stats s
set inserted_count = (
      select count(*) from _sync_students x
      cross join _sync_context ctx
      where not exists (select 1 from public.students p where p.center_id = ctx.center_id and p.code = x.code)
    ),
    updated_count = (
      select count(*) from _sync_students x
      cross join _sync_context ctx
      join public.students p on p.center_id = ctx.center_id and p.code = x.code
      where p.full_name is distinct from x.full_name or p.status is distinct from 'ACTIVE'::public.entity_status
    )
where s.entity = 'students';

update public.students p
set full_name = x.full_name, status = 'ACTIVE'::public.entity_status
from _sync_students x, _sync_context ctx
where p.center_id = ctx.center_id and p.code = x.code;

insert into public.students(center_id, code, full_name, status)
select ctx.center_id, x.code, x.full_name, 'ACTIVE'::public.entity_status
from _sync_students x cross join _sync_context ctx
where not exists (select 1 from public.students p where p.center_id = ctx.center_id and p.code = x.code);

update _sync_stats s
set skipped_count = source_count.total - s.inserted_count - s.updated_count
from (
  select 'classes'::text as entity, count(*)::integer as total from _sync_classes
  union all
  select 'staff'::text, count(*)::integer from _sync_staff
  union all
  select 'students'::text, count(*)::integer from _sync_students
) source_count
where s.entity = source_count.entity;

create temporary table _sync_class_ids on commit drop as
select x.code, c.id
from _sync_classes x cross join _sync_context ctx
join public.classes c on c.center_id = ctx.center_id and c.code = x.code;

create temporary table _sync_staff_ids on commit drop as
select x.code, p.id
from _sync_staff x cross join _sync_context ctx
join public.staff p on p.center_id = ctx.center_id and p.code = x.code;

create temporary table _sync_student_ids on commit drop as
select x.code, p.id, x.class_code
from _sync_students x cross join _sync_context ctx
join public.students p on p.center_id = ctx.center_id and p.code = x.code;

-- Never silently transfer an active student. A mismatch requires manual resolution.
do $$
declare
  conflict_codes text;
begin
  select string_agg(s.code, ', ' order by s.code)
  into conflict_codes
  from _sync_student_ids s
  join public.enrollments e on e.student_id = s.id and e.status = 'ACTIVE'
  join _sync_class_ids expected on expected.code = s.class_code
  where e.class_id <> expected.id;
  if conflict_codes is not null then
    raise exception using message = 'SYNC_CONFLICT_ACTIVE_ENROLLMENT:' || conflict_codes;
  end if;
end;
$$;

update _sync_stats s
set inserted_count = (
      select count(*) from _sync_student_ids x
      join _sync_class_ids expected on expected.code = x.class_code
      where not exists (select 1 from public.enrollments e where e.student_id = x.id and e.class_id = expected.id and e.status = 'ACTIVE')
    ),
    skipped_count = (
      select count(*) from _sync_student_ids x
      join _sync_class_ids expected on expected.code = x.class_code
      where exists (select 1 from public.enrollments e where e.student_id = x.id and e.class_id = expected.id and e.status = 'ACTIVE')
    )
where s.entity = 'enrollments';

insert into public.enrollments(student_id, class_id, enrolled_from, status)
select x.id, expected.id, date '2026-09-01', 'ACTIVE'
from _sync_student_ids x
join _sync_class_ids expected on expected.code = x.class_code
where not exists (select 1 from public.enrollments e where e.student_id = x.id and e.class_id = expected.id and e.status = 'ACTIVE');

-- A source weekday is represented once; unrelated extra schedules are preserved.
update _sync_stats s
set inserted_count = (
      select count(*) from _sync_schedules x
      join _sync_class_ids c on c.code = x.class_code
      where not exists (select 1 from public.class_schedules w where w.class_id = c.id and w.weekday = x.weekday)
    ),
    updated_count = (
      select count(*) from _sync_schedules x
      join _sync_class_ids c on c.code = x.class_code
      where exists (select 1 from public.class_schedules w where w.class_id = c.id and w.weekday = x.weekday and not w.active)
    ),
    skipped_count = (
      select count(*) from _sync_schedules x
      join _sync_class_ids c on c.code = x.class_code
      where exists (select 1 from public.class_schedules w where w.class_id = c.id and w.weekday = x.weekday and w.active)
    )
where s.entity = 'schedules';

update public.class_schedules w
set active = true
from _sync_schedules x
join _sync_class_ids c on c.code = x.class_code
where w.class_id = c.id and w.weekday = x.weekday and not w.active;

insert into public.class_schedules(class_id, weekday, start_time, end_time, active)
select c.id, x.weekday, null::time, null::time, true
from _sync_schedules x
join _sync_class_ids c on c.code = x.class_code
where not exists (select 1 from public.class_schedules w where w.class_id = c.id and w.weekday = x.weekday);

-- A source assignment is identified by class, staff and role; existing dates are preserved.
update _sync_stats s
set inserted_count = (
      select count(*) from _sync_assignments x
      join _sync_class_ids c on c.code = x.class_code
      join _sync_staff_ids p on p.code = x.staff_code
      where not exists (select 1 from public.class_assignments a where a.class_id = c.id and a.staff_id = p.id and a.role = x.role)
    ),
    updated_count = (
      select count(*) from _sync_assignments x
      join _sync_class_ids c on c.code = x.class_code
      join _sync_staff_ids p on p.code = x.staff_code
      where exists (select 1 from public.class_assignments a where a.class_id = c.id and a.staff_id = p.id and a.role = x.role and not a.active)
    ),
    skipped_count = (
      select count(*) from _sync_assignments x
      join _sync_class_ids c on c.code = x.class_code
      join _sync_staff_ids p on p.code = x.staff_code
      where exists (select 1 from public.class_assignments a where a.class_id = c.id and a.staff_id = p.id and a.role = x.role and a.active)
    )
where s.entity = 'assignments';

update public.class_assignments a
set active = true
from _sync_assignments x
join _sync_class_ids c on c.code = x.class_code
join _sync_staff_ids p on p.code = x.staff_code
where a.class_id = c.id and a.staff_id = p.id and a.role = x.role and not a.active;

insert into public.class_assignments(class_id, staff_id, role, start_date, active)
select c.id, p.id, x.role, date '2026-09-01', true
from _sync_assignments x
join _sync_class_ids c on c.code = x.class_code
join _sync_staff_ids p on p.code = x.staff_code
where not exists (select 1 from public.class_assignments a where a.class_id = c.id and a.staff_id = p.id and a.role = x.role);

insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
select ctx.center_id, ctx.admin_user_id, 'MASTER_DATA_SYNC', 'center', ctx.center_id,
       jsonb_build_object(
         'source', 'docs/fill_data/Nguon_Data_Van_Hanh_TrungTam_HungCuong.md',
         'mode', 'SAFE_SYNC',
         'preserved_outside_source', true,
         'entities', (select jsonb_object_agg(entity, jsonb_build_object('inserted', inserted_count, 'updated', updated_count, 'skipped', skipped_count, 'conflicts', conflict_count) order by entity) from _sync_stats)
       ),
       'master-data-sync-' || gen_random_uuid()::text
from _sync_context ctx;

select jsonb_build_object(
  'source', 'docs/fill_data/Nguon_Data_Van_Hanh_TrungTam_HungCuong.md',
  'mode', 'SAFE_SYNC_TRANSACTION',
  'entities', (select jsonb_object_agg(entity, jsonb_build_object('inserted', inserted_count, 'updated', updated_count, 'skipped', skipped_count, 'conflicts', conflict_count) order by entity) from _sync_stats),
  'operational_data_touched', false,
  'storage_touched', false
) as sync_summary;

commit;
