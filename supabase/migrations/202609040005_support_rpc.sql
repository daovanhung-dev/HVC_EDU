begin;

create or replace function public.rpc_create_class_with_schedules(
  p_code text,
  p_name text,
  p_grade int,
  p_subject text,
  p_standard_unit_fee bigint,
  p_collection_method public.collection_method,
  p_note text default null,
  p_schedules jsonb default '[]'::jsonb,
  p_effective_from date default current_date,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_user uuid := auth.uid();
  v_schedule record;
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_code),'')='' or coalesce(trim(p_name),'')='' or coalesce(trim(p_subject),'')=''
     or p_grade not between 1 and 12 or p_standard_unit_fee is null or p_standard_unit_fee < 0
     or p_schedules is null or jsonb_typeof(p_schedules) <> 'array' then
    raise exception using message='VALIDATION_ERROR';
  end if;
  insert into public.classes(center_id,code,name,grade,subject,standard_unit_fee,collection_method,note)
  values (public.current_center_id(),trim(p_code),trim(p_name),p_grade,trim(p_subject),p_standard_unit_fee,p_collection_method,nullif(trim(p_note),''))
  returning id into v_class_id;
  for v_schedule in select * from jsonb_to_recordset(p_schedules) as x(weekday int,start_time time,end_time time) loop
    if v_schedule.weekday not between 1 and 7 then raise exception using message='VALIDATION_ERROR'; end if;
    insert into public.class_schedules(class_id,weekday,start_time,end_time,effective_from)
    values (v_class_id,v_schedule.weekday,v_schedule.start_time,v_schedule.end_time,coalesce(p_effective_from,current_date));
  end loop;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'CLASS_CREATED','class',v_class_id::text,
    jsonb_build_object('code',p_code,'schedule_count',jsonb_array_length(p_schedules)),p_trace_id);
  return jsonb_build_object('class_id',v_class_id);
end;
$$;

create or replace function public.rpc_create_student_enrollment(
  p_code text,
  p_full_name text,
  p_phone text default null,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_class_id uuid default null,
  p_enrolled_from date default current_date,
  p_unit_price_override bigint default null,
  p_tuition_exempt boolean default false,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_enrollment_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_code),'')='' or coalesce(trim(p_full_name),'')='' or p_unit_price_override < 0 then raise exception using message='VALIDATION_ERROR'; end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id=p_class_id and center_id=public.current_center_id() and status='ACTIVE') then raise exception using message='CLASS_NOT_FOUND'; end if;
  insert into public.students(center_id,code,full_name,phone,parent_name,parent_phone,note)
  values (public.current_center_id(),trim(p_code),trim(p_full_name),nullif(trim(p_phone),''),nullif(trim(p_parent_name),''),nullif(trim(p_parent_phone),''),nullif(trim(p_note),''))
  returning id into v_student_id;
  if p_class_id is not null then
    insert into public.enrollments(student_id,class_id,enrolled_from,unit_price_override,tuition_exempt,note)
    values (v_student_id,p_class_id,coalesce(p_enrolled_from,current_date),p_unit_price_override,coalesce(p_tuition_exempt,false),nullif(trim(p_note),''))
    returning id into v_enrollment_id;
  end if;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'STUDENT_CREATED','student',v_student_id::text,
    jsonb_build_object('code',p_code,'enrollment_id',v_enrollment_id),p_trace_id);
  return jsonb_build_object('student_id',v_student_id,'enrollment_id',v_enrollment_id);
end;
$$;

create or replace function public.rpc_create_assignment(
  p_class_id uuid,
  p_staff_id uuid,
  p_role public.assignment_role,
  p_period_id uuid default null,
  p_planned_sessions int default null,
  p_start_date date default current_date,
  p_end_date date default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if p_planned_sessions is not null and p_planned_sessions < 0 or p_end_date is not null and p_end_date < p_start_date then raise exception using message='VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.classes where id=p_class_id and center_id=public.current_center_id() and status='ACTIVE') then raise exception using message='CLASS_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.staff s
    where s.id=p_staff_id and s.center_id=public.current_center_id() and s.status='ACTIVE'
      and s.staff_type = case when p_role='ASSISTANT' then 'ASSISTANT'::public.staff_type else 'TEACHER'::public.staff_type end
  ) then raise exception using message='STAFF_NOT_FOUND'; end if;
  if p_period_id is not null and not exists (select 1 from public.accounting_periods where id=p_period_id and center_id=public.current_center_id()) then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if exists (
    select 1 from public.class_assignments a
    where a.class_id=p_class_id and a.staff_id=p_staff_id and a.role=p_role
      and (a.period_id=p_period_id or a.period_id is null or p_period_id is null)
      and a.start_date <= coalesce(p_end_date, date '9999-12-31')
      and (a.end_date is null or a.end_date >= p_start_date)
  ) then raise exception using message='CONFLICT'; end if;
  insert into public.class_assignments(class_id,staff_id,period_id,role,planned_sessions,start_date,end_date)
  values (p_class_id,p_staff_id,p_period_id,p_role,p_planned_sessions,p_start_date,p_end_date)
  returning id into v_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'ASSIGNMENT_CREATED','class_assignment',v_id::text,
    jsonb_build_object('class_id',p_class_id,'staff_id',p_staff_id,'role',p_role),p_trace_id);
  return jsonb_build_object('assignment_id',v_id);
end;
$$;

create or replace function public.rpc_update_profile_role(
  p_user_id uuid,
  p_role public.app_role,
  p_active boolean default true,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_before record;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  select * into v_before from public.profiles where user_id=p_user_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='PROFILE_NOT_FOUND'; end if;
  update public.profiles set role=p_role,active=coalesce(p_active,true),updated_at=now() where user_id=p_user_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,before_data,after_data,trace_id)
  values (public.current_center_id(),v_user,'PROFILE_ROLE_UPDATED','profile',p_user_id::text,
    jsonb_build_object('role',v_before.role,'active',v_before.active),jsonb_build_object('role',p_role,'active',p_active),p_trace_id);
  return jsonb_build_object('user_id',p_user_id,'role',p_role,'active',p_active);
end;
$$;

create or replace function public.rpc_import_normalized_workbook(
  p_import_job_id uuid,
  p_payload jsonb,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_job record;
  v_class record;
  v_staff record;
  v_student record;
  v_class_id uuid;
  v_student_id uuid;
  v_user uuid := auth.uid();
  v_classes int := 0;
  v_staff_count int := 0;
  v_students int := 0;
  v_enrollments int := 0;
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception using message='VALIDATION_ERROR'; end if;
  select * into v_job from public.import_jobs where id=p_import_job_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='NOT_FOUND'; end if;
  if v_job.status='COMPLETED' then return coalesce(v_job.summary->'imported','{}'::jsonb); end if;
  update public.import_jobs set status='IMPORTING',started_at=coalesce(started_at,now()),updated_at=now() where id=p_import_job_id;

  for v_class in select * from jsonb_to_recordset(coalesce(p_payload->'classes','[]'::jsonb)) as x(code text,name text,grade int,subject text,standard_unit_fee bigint,collection_method text,note text) loop
    if coalesce(trim(v_class.code),'')='' or coalesce(trim(v_class.name),'')='' or v_class.grade not between 1 and 12 or coalesce(v_class.standard_unit_fee,0) < 0 then raise exception using message='IMPORT_VALIDATION_FAILED'; end if;
    insert into public.classes(center_id,code,name,grade,subject,standard_unit_fee,collection_method,note)
    values (public.current_center_id(),trim(v_class.code),trim(v_class.name),v_class.grade,coalesce(nullif(trim(v_class.subject),''),'Toán'),coalesce(v_class.standard_unit_fee,0),coalesce(v_class.collection_method,'PER_SESSION')::public.collection_method,nullif(trim(v_class.note),''))
    on conflict (center_id,code) do update set name=excluded.name,grade=excluded.grade,subject=excluded.subject,standard_unit_fee=excluded.standard_unit_fee,collection_method=excluded.collection_method,note=excluded.note
    returning id into v_class_id;
    v_classes := v_classes + 1;
  end loop;

  for v_staff in select * from jsonb_to_recordset(coalesce(p_payload->'staff','[]'::jsonb)) as x(code text,full_name text,staff_type text,phone text,primary_subject text,note text) loop
    if coalesce(trim(v_staff.code),'')='' or coalesce(trim(v_staff.full_name),'')='' or v_staff.staff_type not in ('TEACHER','ASSISTANT') then raise exception using message='IMPORT_VALIDATION_FAILED'; end if;
    insert into public.staff(center_id,code,full_name,staff_type,phone,primary_subject,note)
    values (public.current_center_id(),trim(v_staff.code),trim(v_staff.full_name),v_staff.staff_type::public.staff_type,nullif(trim(v_staff.phone),''),nullif(trim(v_staff.primary_subject),''),nullif(trim(v_staff.note),''))
    on conflict (center_id,code) do update set full_name=excluded.full_name,staff_type=excluded.staff_type,phone=excluded.phone,primary_subject=excluded.primary_subject,note=excluded.note;
    v_staff_count := v_staff_count + 1;
  end loop;

  for v_student in select * from jsonb_to_recordset(coalesce(p_payload->'students','[]'::jsonb)) as x(code text,full_name text,phone text,parent_name text,parent_phone text,note text,class_code text,enrolled_from date,unit_price_override bigint) loop
    if coalesce(trim(v_student.code),'')='' or coalesce(trim(v_student.full_name),'')='' or v_student.unit_price_override < 0 then raise exception using message='IMPORT_VALIDATION_FAILED'; end if;
    insert into public.students(center_id,code,full_name,phone,parent_name,parent_phone,note)
    values (public.current_center_id(),trim(v_student.code),trim(v_student.full_name),nullif(trim(v_student.phone),''),nullif(trim(v_student.parent_name),''),nullif(trim(v_student.parent_phone),''),nullif(trim(v_student.note),''))
    on conflict (center_id,code) do update set full_name=excluded.full_name,phone=excluded.phone,parent_name=excluded.parent_name,parent_phone=excluded.parent_phone,note=excluded.note
    returning id into v_student_id;
    v_students := v_students + 1;
    if coalesce(trim(v_student.class_code),'') <> '' then
      select id into v_class_id from public.classes where center_id=public.current_center_id() and code=trim(v_student.class_code);
      if v_class_id is null then raise exception using message='CLASS_NOT_FOUND'; end if;
      if not exists (select 1 from public.enrollments where student_id=v_student_id and class_id=v_class_id and status='ACTIVE') then
        insert into public.enrollments(student_id,class_id,enrolled_from,unit_price_override)
        values (v_student_id,v_class_id,coalesce(v_student.enrolled_from,current_date),v_student.unit_price_override);
        v_enrollments := v_enrollments + 1;
      end if;
    end if;
  end loop;
  update public.import_jobs set summary=summary || jsonb_build_object('imported',jsonb_build_object('classes',v_classes,'staff',v_staff_count,'students',v_students,'enrollments',v_enrollments)),status='COMPLETED',completed_at=now(),updated_at=now() where id=p_import_job_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'WORKBOOK_IMPORTED','import_job',p_import_job_id::text,jsonb_build_object('classes',v_classes,'staff',v_staff_count,'students',v_students,'enrollments',v_enrollments),p_trace_id);
  return jsonb_build_object('classes',v_classes,'staff',v_staff_count,'students',v_students,'enrollments',v_enrollments);
end;
$$;

create or replace function public.rpc_create_staff(
  p_code text,
  p_full_name text,
  p_staff_type public.staff_type,
  p_phone text default null,
  p_primary_subject text default null,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_code),'')='' or coalesce(trim(p_full_name),'')='' then raise exception using message='VALIDATION_ERROR'; end if;
  insert into public.staff(center_id,code,full_name,staff_type,phone,primary_subject,note)
  values (public.current_center_id(),trim(p_code),trim(p_full_name),p_staff_type,nullif(trim(p_phone),''),nullif(trim(p_primary_subject),''),nullif(trim(p_note),''))
  returning id into v_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'STAFF_CREATED','staff',v_id::text,jsonb_build_object('code',p_code,'staff_type',p_staff_type),p_trace_id);
  return jsonb_build_object('staff_id',v_id);
end;
$$;

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
language plpgsql security definer
set search_path = public
as $$
declare
  v_before record;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_code),'')='' or coalesce(trim(p_name),'')='' or coalesce(trim(p_subject),'')=''
     or p_grade not between 1 and 12 or p_standard_unit_fee is null or p_standard_unit_fee < 0 then
    raise exception using message='VALIDATION_ERROR';
  end if;
  select * into v_before from public.classes where id=p_class_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='CLASS_NOT_FOUND'; end if;
  update public.classes set code=trim(p_code),name=trim(p_name),grade=p_grade,subject=trim(p_subject),
    standard_unit_fee=p_standard_unit_fee,collection_method=p_collection_method,status=p_status,
    note=nullif(trim(p_note),''),updated_at=now()
  where id=p_class_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,before_data,after_data,trace_id)
  values (public.current_center_id(),v_user,'CLASS_UPDATED','class',p_class_id::text,
    jsonb_build_object('code',v_before.code,'name',v_before.name,'status',v_before.status,'standard_unit_fee',v_before.standard_unit_fee),
    jsonb_build_object('code',p_code,'name',p_name,'status',p_status,'standard_unit_fee',p_standard_unit_fee),p_trace_id);
  return jsonb_build_object('class_id',p_class_id);
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
language plpgsql security definer
set search_path = public
as $$
declare
  v_before record;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_code),'')='' or coalesce(trim(p_full_name),'')='' then raise exception using message='VALIDATION_ERROR'; end if;
  select * into v_before from public.students where id=p_student_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='STUDENT_NOT_FOUND'; end if;
  update public.students set code=trim(p_code),full_name=trim(p_full_name),phone=nullif(trim(p_phone),''),
    parent_name=nullif(trim(p_parent_name),''),parent_phone=nullif(trim(p_parent_phone),''),status=p_status,
    note=nullif(trim(p_note),''),updated_at=now()
  where id=p_student_id;
  if p_status = 'INACTIVE' then
    update public.enrollments set status='LEFT',enrolled_to=coalesce(enrolled_to,current_date),updated_at=now()
    where student_id=p_student_id and status='ACTIVE';
  end if;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,before_data,after_data,trace_id)
  values (public.current_center_id(),v_user,'STUDENT_UPDATED','student',p_student_id::text,
    jsonb_build_object('code',v_before.code,'full_name',v_before.full_name,'status',v_before.status),
    jsonb_build_object('code',p_code,'full_name',p_full_name,'status',p_status),p_trace_id);
  return jsonb_build_object('student_id',p_student_id);
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
language plpgsql security definer
set search_path = public
as $$
declare
  v_before record;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_code),'')='' or coalesce(trim(p_full_name),'')='' then raise exception using message='VALIDATION_ERROR'; end if;
  select * into v_before from public.staff where id=p_staff_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='STAFF_NOT_FOUND'; end if;
  update public.staff set code=trim(p_code),full_name=trim(p_full_name),staff_type=p_staff_type,
    phone=nullif(trim(p_phone),''),primary_subject=nullif(trim(p_primary_subject),''),status=p_status,
    note=nullif(trim(p_note),''),updated_at=now()
  where id=p_staff_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,before_data,after_data,trace_id)
  values (public.current_center_id(),v_user,'STAFF_UPDATED','staff',p_staff_id::text,
    jsonb_build_object('code',v_before.code,'full_name',v_before.full_name,'status',v_before.status),
    jsonb_build_object('code',p_code,'full_name',p_full_name,'status',p_status),p_trace_id);
  return jsonb_build_object('staff_id',p_staff_id);
end;
$$;

create or replace function public.rpc_create_period(
  p_year int,
  p_month int,
  p_start_date date,
  p_end_date date,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.is_admin() then raise exception using message=case when v_user is null then 'UNAUTHENTICATED' else 'FORBIDDEN' end; end if;
  if p_year not between 2020 and 2100 or p_month not between 1 and 12 or p_end_date < p_start_date then raise exception using message='VALIDATION_ERROR'; end if;
  insert into public.accounting_periods(center_id,year,month,start_date,end_date,status)
  values (public.current_center_id(),p_year,p_month,p_start_date,p_end_date,'OPEN')
  on conflict (center_id,year,month) do update set updated_at=now()
  returning id into v_id;
  if v_id is null then select id into v_id from public.accounting_periods where center_id=public.current_center_id() and year=p_year and month=p_month; end if;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PERIOD_CREATED','accounting_period',v_id::text,jsonb_build_object('year',p_year,'month',p_month),p_trace_id);
  return jsonb_build_object('period_id',v_id);
end;
$$;

create or replace function public.rpc_record_financial_transaction(
  p_period_id uuid,
  p_transaction_date date,
  p_type public.financial_transaction_type,
  p_category text,
  p_description text,
  p_amount bigint,
  p_class_id uuid default null,
  p_attachment_path text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  if p_amount is null or p_amount <= 0 or coalesce(trim(p_category),'')='' or coalesce(trim(p_description),'')='' or p_transaction_date is null then raise exception using message='VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.accounting_periods p where p.id=p_period_id and p.center_id=public.current_center_id() and p.status='OPEN') then raise exception using message='PERIOD_NOT_OPEN'; end if;
  if p_class_id is not null and not exists (select 1 from public.classes c where c.id=p_class_id and c.center_id=public.current_center_id()) then raise exception using message='CLASS_NOT_FOUND'; end if;
  insert into public.financial_transactions(period_id,transaction_date,type,category,class_id,description,amount,attachment_path,created_by)
  values (p_period_id,p_transaction_date,p_type,trim(p_category),p_class_id,trim(p_description),p_amount,p_attachment_path,v_user) returning id into v_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'FINANCIAL_TRANSACTION_CREATED','financial_transaction',v_id::text,jsonb_build_object('period_id',p_period_id,'type',p_type,'amount',p_amount),p_trace_id);
  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.rpc_record_student_reward(
  p_period_id uuid,
  p_student_id uuid,
  p_amount bigint,
  p_reason text,
  p_class_id uuid default null,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  if p_amount is null or p_amount < 0 or coalesce(trim(p_reason),'')='' then raise exception using message='VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.accounting_periods p where p.id=p_period_id and p.center_id=public.current_center_id() and p.status='OPEN') then raise exception using message='PERIOD_NOT_OPEN'; end if;
  if not exists (select 1 from public.students s where s.id=p_student_id and s.center_id=public.current_center_id()) then raise exception using message='STUDENT_NOT_FOUND'; end if;
  if p_class_id is not null and not exists (select 1 from public.classes c where c.id=p_class_id and c.center_id=public.current_center_id()) then raise exception using message='CLASS_NOT_FOUND'; end if;
  insert into public.student_rewards(period_id,student_id,class_id,amount,reason,note,created_by)
  values (p_period_id,p_student_id,p_class_id,p_amount,trim(p_reason),p_note,v_user) returning id into v_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'STUDENT_REWARD_CREATED','student_reward',v_id::text,jsonb_build_object('period_id',p_period_id,'amount',p_amount),p_trace_id);
  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.rpc_upsert_setting(
  p_key text,
  p_value_json jsonb,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() or coalesce(trim(p_key),'')='' then raise exception using message=case when not public.is_admin() then 'FORBIDDEN' else 'VALIDATION_ERROR' end; end if;
  insert into public.system_settings(center_id,key,value_json,updated_by,updated_at)
  values (public.current_center_id(),trim(p_key),coalesce(p_value_json,'{}'::jsonb),v_user,now())
  on conflict (center_id,key) do update set value_json=excluded.value_json,updated_by=excluded.updated_by,updated_at=now()
  returning id into v_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'SETTING_UPDATED','system_setting',v_id::text,jsonb_build_object('key',p_key),p_trace_id);
  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.rpc_upsert_profit_distribution(
  p_period_id uuid,
  p_recipient_name text,
  p_ratio numeric,
  p_recipient_user_id uuid default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_recipient_name),'')='' or p_ratio is null or p_ratio < 0 or p_ratio > 1 then raise exception using message='VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.accounting_periods p where p.id=p_period_id and p.center_id=public.current_center_id() and p.status='OPEN') then raise exception using message='PERIOD_NOT_OPEN'; end if;
  insert into public.profit_distributions(period_id,recipient_name,recipient_user_id,ratio)
  values (p_period_id,trim(p_recipient_name),p_recipient_user_id,p_ratio)
  on conflict (period_id,recipient_name) do update set recipient_user_id=excluded.recipient_user_id,ratio=excluded.ratio
  returning id into v_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PROFIT_DISTRIBUTION_UPDATED','profit_distribution',v_id::text,jsonb_build_object('period_id',p_period_id,'ratio',p_ratio),p_trace_id);
  return jsonb_build_object('id',v_id);
end;
$$;

grant execute on function public.rpc_create_period(int,int,date,date,text) to authenticated;
grant execute on function public.rpc_create_class_with_schedules(text,text,int,text,bigint,public.collection_method,text,jsonb,date,text) to authenticated;
grant execute on function public.rpc_create_student_enrollment(text,text,text,text,text,uuid,date,bigint,boolean,text,text) to authenticated;
grant execute on function public.rpc_create_assignment(uuid,uuid,public.assignment_role,uuid,int,date,date,text) to authenticated;
grant execute on function public.rpc_create_staff(text,text,public.staff_type,text,text,text,text) to authenticated;
grant execute on function public.rpc_update_class(uuid,text,text,int,text,bigint,public.collection_method,public.entity_status,text,text) to authenticated;
grant execute on function public.rpc_update_student(uuid,text,text,text,text,text,public.entity_status,text,text) to authenticated;
grant execute on function public.rpc_update_staff(uuid,text,text,public.staff_type,text,text,public.entity_status,text,text) to authenticated;
grant execute on function public.rpc_update_profile_role(uuid,public.app_role,boolean,text) to authenticated;
grant execute on function public.rpc_import_normalized_workbook(uuid,jsonb,text) to authenticated;
grant execute on function public.rpc_record_financial_transaction(uuid,date,public.financial_transaction_type,text,text,bigint,uuid,text,text) to authenticated;
grant execute on function public.rpc_record_student_reward(uuid,uuid,bigint,text,uuid,text,text) to authenticated;
grant execute on function public.rpc_upsert_setting(text,jsonb,text) to authenticated;
grant execute on function public.rpc_upsert_profit_distribution(uuid,text,numeric,uuid,text) to authenticated;

commit;
