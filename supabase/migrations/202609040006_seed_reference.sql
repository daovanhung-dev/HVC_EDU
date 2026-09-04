begin;

-- Reference data from the August workbook snapshot. Personal student rows are
-- intentionally not invented when the source workbook is not present.
insert into public.staff(center_id,code,full_name,staff_type,phone,primary_subject,status,note)
select c.id,v.code,v.full_name,v.staff_type::public.staff_type,v.phone,'Toán','ACTIVE',v.note
from public.centers c
cross join (values
  ('GV001','Nguyễn Mạnh Cường','TEACHER',null,'Dạy Toán 6, 7, 8, 9'),
  ('GV002','Nguyễn Thị Huệ','TEACHER',null,''),
  ('TG001','Đào Quang Duy','ASSISTANT','0394475010','Trợ giảng Toán 7'),
  ('TG002','Đào Phương Anh','ASSISTANT',null,'Trợ giảng Toán 8, 9'),
  ('TG003','Nguyễn Hà Anh','ASSISTANT',null,'Trợ giảng Toán 6')
) as v(code,full_name,staff_type,phone,note)
where c.code='HC'
on conflict(center_id,code) do nothing;

insert into public.accounting_periods(center_id,year,month,start_date,end_date,status)
select c.id,2026,8,date '2026-08-01',date '2026-08-31','OPEN'
from public.centers c where c.code='HC'
on conflict(center_id,year,month) do nothing;
insert into public.accounting_periods(center_id,year,month,start_date,end_date,status)
select c.id,2026,9,date '2026-09-01',date '2026-09-30','OPEN'
from public.centers c where c.code='HC'
on conflict(center_id,year,month) do nothing;

insert into public.class_schedules(class_id,weekday,effective_from)
select c.id,v.weekday,date '2026-08-01'
from public.classes c cross join (values ('L06',4),('L06',7),('L07',2),('L07',5),('L08',2),('L08',7),('L09',1),('L09',4)) v(code,weekday)
where c.code=v.code and not exists (select 1 from public.class_schedules s where s.class_id=c.id and s.weekday=v.weekday and s.effective_from=date '2026-08-01');

insert into public.class_assignments(class_id,staff_id,role,start_date)
select c.id,s.id,'MAIN_TEACHER',date '2026-08-01'
from public.classes c join public.staff s on s.code='GV001' and s.center_id=c.center_id
where c.code in ('L06','L07','L08','L09') and not exists (select 1 from public.class_assignments a where a.class_id=c.id and a.staff_id=s.id and a.role='MAIN_TEACHER' and a.start_date=date '2026-08-01');
insert into public.class_assignments(class_id,staff_id,role,start_date)
select c.id,s.id,'ASSISTANT',date '2026-08-01'
from public.classes c join public.staff s on s.code=case c.code when 'L06' then 'TG003' when 'L07' then 'TG001' else 'TG002' end and s.center_id=c.center_id
where c.code in ('L06','L07','L08','L09') and not exists (select 1 from public.class_assignments a where a.class_id=c.id and a.staff_id=s.id and a.role='ASSISTANT' and a.start_date=date '2026-08-01');

insert into public.system_settings(center_id,key,value_json)
select id,'fund','{"fund_percent":0.10}'::jsonb from public.centers where code='HC'
on conflict(center_id,key) do nothing;

insert into public.payroll_policies(center_id,name,teacher_percent,assistant_percent,max_total_percent,rounding_step,effective_from)
select id,'Chính sách snapshot 25/15 từ 2026-01-01',0.25,0.15,0.40,50000,date '2026-01-01'
from public.centers where code='HC'
and not exists (select 1 from public.payroll_policies where center_id=public.centers.id and effective_from=date '2026-01-01');

commit;
