begin;

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
  v_period record;
  v_class record;
  v_date date;
  v_schedule record;
  v_created int := 0;
  v_existing int := 0;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  select * into v_class from public.classes where id=p_class_id and center_id=public.current_center_id();
  if not found then raise exception using message='CLASS_NOT_FOUND'; end if;
  select * into v_period from public.accounting_periods where id=p_period_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if v_period.status <> 'OPEN' then raise exception using message='PERIOD_NOT_OPEN'; end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id=p_class_id and center_id=public.current_center_id()) then raise exception using message='CLASS_NOT_FOUND'; end if;

  v_date := v_period.start_date;
  while v_date <= v_period.end_date loop
    for v_schedule in
      select * from public.class_schedules s
      where s.class_id=p_class_id and s.active=true
        and s.weekday=extract(isodow from v_date)::smallint
        and s.effective_from <= v_date
        and (s.effective_to is null or s.effective_to >= v_date)
    loop
      if exists (select 1 from public.class_sessions cs
                 where cs.class_id=p_class_id and cs.session_date=v_date
                   and cs.start_time is not distinct from v_schedule.start_time) then
        v_existing := v_existing + 1;
      else
        insert into public.class_sessions(class_id,period_id,session_date,start_time,end_time,status)
        values (p_class_id,p_period_id,v_date,v_schedule.start_time,v_schedule.end_time,'SCHEDULED');
        v_created := v_created + 1;
      end if;
    end loop;
    v_date := v_date + 1;
  end loop;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (v_class.center_id,v_user,'SESSIONS_GENERATED','class',p_class_id::text,
    jsonb_build_object('period_id',p_period_id,'created',v_created,'existing',v_existing),p_trace_id);
  return jsonb_build_object('created',v_created,'existing',v_existing);
end;
$$;

create or replace function public.rpc_bulk_attendance(
  p_session_id uuid,
  p_items jsonb,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_session record;
  v_item record;
  v_saved int := 0;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  select s.*, p.status as period_status into v_session
  from public.class_sessions s join public.accounting_periods p on p.id=s.period_id
  join public.classes c on c.id=s.class_id
  where s.id=p_session_id and c.center_id=public.current_center_id();
  if not found then raise exception using message='SESSION_NOT_FOUND'; end if;
  if v_session.period_status = 'CLOSED' then raise exception using message='PERIOD_CLOSED'; end if;
  if not public.has_class_assignment(v_session.class_id, v_session.session_date) then raise exception using message='CLASS_NOT_ASSIGNED'; end if;

  for v_item in select * from jsonb_to_recordset(p_items) as x(enrollment_id uuid, status text, note text) loop
    if v_item.status not in ('PRESENT','ABSENT','EXCUSED') then raise exception using message='VALIDATION_ERROR'; end if;
    if not exists (
      select 1 from public.enrollments e
      where e.id=v_item.enrollment_id and e.class_id=v_session.class_id
        and e.enrolled_from <= v_session.session_date
        and (e.enrolled_to is null or e.enrolled_to >= v_session.session_date)
        and e.status='ACTIVE'
    ) then raise exception using message='ENROLLMENT_NOT_ACTIVE'; end if;
    insert into public.attendance(session_id,enrollment_id,status,note,marked_by,marked_at,updated_at)
    values (p_session_id,v_item.enrollment_id,v_item.status::public.attendance_status,v_item.note,v_user,now(),now())
    on conflict(session_id,enrollment_id) do update set
      status=excluded.status,note=excluded.note,marked_by=excluded.marked_by,
      marked_at=excluded.marked_at,updated_at=now();
    v_saved := v_saved + 1;
  end loop;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'ATTENDANCE_BULK_UPSERT','class_session',p_session_id::text,
    jsonb_build_object('saved',v_saved),p_trace_id);
  return jsonb_build_object('session_id',p_session_id,'saved',v_saved);
end;
$$;

create or replace function public.rpc_bulk_evaluation(
  p_session_id uuid,
  p_items jsonb,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_session record;
  v_item record;
  v_saved int := 0;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  select s.*, p.status as period_status into v_session
  from public.class_sessions s join public.accounting_periods p on p.id=s.period_id
  join public.classes c on c.id=s.class_id
  where s.id=p_session_id and c.center_id=public.current_center_id();
  if not found then raise exception using message='SESSION_NOT_FOUND'; end if;
  if v_session.period_status = 'CLOSED' then raise exception using message='PERIOD_CLOSED'; end if;
  if not public.has_class_assignment(v_session.class_id, v_session.session_date) then raise exception using message='CLASS_NOT_ASSIGNED'; end if;

  for v_item in select * from jsonb_to_recordset(p_items) as x(
    enrollment_id uuid, homework_score numeric, understanding_score numeric,
    attitude_score numeric, learning_gap text, comment text
  ) loop
    if v_item.homework_score is not null and (v_item.homework_score < 0 or v_item.homework_score > 10) then raise exception using message='VALIDATION_ERROR'; end if;
    if v_item.understanding_score is not null and (v_item.understanding_score < 0 or v_item.understanding_score > 10) then raise exception using message='VALIDATION_ERROR'; end if;
    if v_item.attitude_score is not null and (v_item.attitude_score < 0 or v_item.attitude_score > 10) then raise exception using message='VALIDATION_ERROR'; end if;
    if not exists (select 1 from public.enrollments e where e.id=v_item.enrollment_id and e.class_id=v_session.class_id
      and e.enrolled_from <= v_session.session_date and (e.enrolled_to is null or e.enrolled_to >= v_session.session_date)
      and e.status='ACTIVE') then raise exception using message='ENROLLMENT_NOT_ACTIVE'; end if;
    insert into public.student_session_evaluations(session_id,enrollment_id,homework_score,understanding_score,attitude_score,learning_gap,comment,created_by,updated_at)
    values (p_session_id,v_item.enrollment_id,v_item.homework_score,v_item.understanding_score,v_item.attitude_score,v_item.learning_gap,v_item.comment,v_user,now())
    on conflict(session_id,enrollment_id) do update set homework_score=excluded.homework_score,
      understanding_score=excluded.understanding_score,attitude_score=excluded.attitude_score,
      learning_gap=excluded.learning_gap,comment=excluded.comment,updated_at=now();
    v_saved := v_saved + 1;
  end loop;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'EVALUATION_BULK_UPSERT','class_session',p_session_id::text,
    jsonb_build_object('saved',v_saved),p_trace_id);
  return jsonb_build_object('session_id',p_session_id,'saved',v_saved);
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
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  select * into v_period from public.accounting_periods where id=p_period_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if v_period.status <> 'OPEN' then raise exception using message='PERIOD_NOT_OPEN'; end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id=p_class_id and center_id=public.current_center_id()) then raise exception using message='CLASS_NOT_FOUND'; end if;

  for v_enrollment in
    select e.id,e.class_id,e.unit_price_override,e.tuition_exempt,c.standard_unit_fee,c.collection_method
    from public.enrollments e join public.classes c on c.id=e.class_id
    where c.center_id=public.current_center_id() and e.status='ACTIVE'
      and e.enrolled_from <= v_period.end_date and (e.enrolled_to is null or e.enrolled_to >= v_period.start_date)
      and (p_class_id is null or e.class_id=p_class_id)
  loop
    select count(*) filter (where a.status='PRESENT'), count(*) filter (where a.status='ABSENT')
      into v_present,v_absent
      from public.class_sessions s left join public.attendance a on a.session_id=s.id and a.enrollment_id=v_enrollment.id
      where s.class_id=v_enrollment.class_id and s.period_id=p_period_id and s.status <> 'CANCELLED';
    if v_enrollment.collection_method='PREPAID' then
      select count(*) into v_billable from public.class_sessions s
      where s.class_id=v_enrollment.class_id and s.period_id=p_period_id and s.status <> 'CANCELLED';
    else
      v_billable := v_present;
    end if;
    v_unit := coalesce(v_enrollment.unit_price_override,v_enrollment.standard_unit_fee);
    if v_enrollment.tuition_exempt then v_unit := 0; end if;
    v_gross := v_billable * v_unit;
    select coalesce(sum(case when type in ('OPENING_DEBT','CARRY_IN') then greatest(amount,0) else 0 end),0),
           coalesce(sum(case when type in ('MANUAL') then greatest(amount,0) else 0 end),0),
           coalesce(sum(case when type='DISCOUNT' then greatest(amount,0) else 0 end),0)
      into v_opening,v_positive,v_discount
      from public.tuition_adjustments where period_id=p_period_id and enrollment_id=v_enrollment.id;
    v_due := greatest(0,v_gross + v_opening + v_positive - v_discount);
    select coalesce(sum(amount) filter (where voided_at is null),0) into v_paid
      from public.payments p join public.tuition_ledgers l on l.id=p.tuition_ledger_id
      where l.period_id=p_period_id and l.enrollment_id=v_enrollment.id;
    select * into v_ledger from public.tuition_ledgers where period_id=p_period_id and enrollment_id=v_enrollment.id for update;
    if not found then
      insert into public.tuition_ledgers(period_id,enrollment_id,attended_sessions,absent_sessions,billable_sessions,unit_price,gross_amount,opening_debt,adjustment_amount,amount_due,paid_amount,debt_amount,status)
      values (p_period_id,v_enrollment.id,v_present,v_absent,v_billable,v_unit,v_gross,v_opening,v_positive-v_discount,v_due,v_paid,greatest(0,v_due-v_paid),
        (case when v_paid >= v_due then 'PAID' when v_paid > 0 then 'PARTIAL' else 'CONFIRMED' end)::public.ledger_status);
      v_created := v_created + 1;
    elsif v_ledger.status='DRAFT' then
      update public.tuition_ledgers set attended_sessions=v_present,absent_sessions=v_absent,billable_sessions=v_billable,
        unit_price=v_unit,gross_amount=v_gross,opening_debt=v_opening,adjustment_amount=v_positive-v_discount,
        amount_due=v_due,paid_amount=v_paid,debt_amount=greatest(0,v_due-v_paid),status=case when v_paid >= v_due then 'PAID' when v_paid > 0 then 'PARTIAL' else 'CONFIRMED' end,updated_at=now()
      where id=v_ledger.id;
      v_updated := v_updated + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'TUITION_GENERATED','accounting_period',p_period_id::text,
    jsonb_build_object('class_id',p_class_id,'created',v_created,'updated',v_updated,'skipped',v_skipped),p_trace_id);
  return jsonb_build_object('created',v_created,'updated',v_updated,'skipped',v_skipped,
    'total_due',(select coalesce(sum(amount_due),0) from public.tuition_ledgers where period_id=p_period_id));
end;
$$;

create or replace function public.rpc_record_payment(
  p_ledger_id uuid,
  p_amount bigint,
  p_paid_at timestamptz,
  p_method public.payment_method,
  p_reference text default null,
  p_note text default null,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_ledger record;
  v_paid bigint;
  v_debt bigint;
  v_payment_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  if p_amount is null or p_amount <= 0 then raise exception using message='VALIDATION_ERROR'; end if;
  select l.* into v_ledger from public.tuition_ledgers l
  join public.enrollments e on e.id=l.enrollment_id join public.classes c on c.id=e.class_id
  join public.accounting_periods p on p.id=l.period_id
  where l.id=p_ledger_id and c.center_id=public.current_center_id() for update;
  if not found then raise exception using message='LEDGER_NOT_FOUND'; end if;
  if (select status from public.accounting_periods where id=v_ledger.period_id) <> 'OPEN' then raise exception using message='PERIOD_CLOSED'; end if;
  v_paid := coalesce((select sum(amount) from public.payments where tuition_ledger_id=p_ledger_id and voided_at is null),0);
  v_debt := greatest(0,v_ledger.amount_due-v_paid);
  if p_amount > v_debt then raise exception using message='PAYMENT_EXCEEDS_DEBT'; end if;
  insert into public.payments(tuition_ledger_id,amount,paid_at,method,reference,note,created_by)
  values (p_ledger_id,p_amount,p_paid_at,p_method,p_reference,p_note,v_user) returning id into v_payment_id;
  v_paid := v_paid + p_amount;
  update public.tuition_ledgers set paid_amount=v_paid,debt_amount=greatest(0,amount_due-v_paid),
    status=(case when v_paid >= amount_due then 'PAID' when v_paid > 0 then 'PARTIAL' else 'UNPAID' end)::public.ledger_status,updated_at=now()
  where id=p_ledger_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PAYMENT_CREATED','payment',v_payment_id::text,
    jsonb_build_object('ledger_id',p_ledger_id,'amount',p_amount,'paid_amount',v_paid),p_trace_id);
  return jsonb_build_object('payment_id',v_payment_id,'ledger_id',p_ledger_id,'paid_amount',v_paid,'debt_amount',greatest(0,v_ledger.amount_due-v_paid));
end;
$$;

create or replace function public.rpc_void_payment(
  p_payment_id uuid,
  p_reason text,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_payment record;
  v_paid bigint;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception using message='VALIDATION_ERROR'; end if;
  select p.*,l.amount_due,l.period_id into v_payment from public.payments p join public.tuition_ledgers l on l.id=p.tuition_ledger_id
  join public.enrollments e on e.id=l.enrollment_id join public.classes c on c.id=e.class_id
  where p.id=p_payment_id and c.center_id=public.current_center_id() for update;
  if not found then raise exception using message='PAYMENT_NOT_FOUND'; end if;
  if v_payment.voided_at is not null then raise exception using message='PAYMENT_ALREADY_VOIDED'; end if;
  if (select status from public.accounting_periods where id=v_payment.period_id) <> 'OPEN' then raise exception using message='PERIOD_CLOSED'; end if;
  update public.payments set voided_at=now(),voided_by=v_user,note=concat_ws(' | ',note,'VOID: '||p_reason) where id=p_payment_id;
  select coalesce(sum(amount) filter (where voided_at is null),0) into v_paid from public.payments where tuition_ledger_id=v_payment.tuition_ledger_id;
  update public.tuition_ledgers set paid_amount=v_paid,debt_amount=greatest(0,amount_due-v_paid),
    status=(case when v_paid >= amount_due then 'PAID' when v_paid > 0 then 'PARTIAL' else 'UNPAID' end)::public.ledger_status,updated_at=now()
  where id=v_payment.tuition_ledger_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PAYMENT_VOIDED','payment',p_payment_id::text,
    jsonb_build_object('reason',p_reason,'paid_amount',v_paid),p_trace_id);
  return jsonb_build_object('payment_id',p_payment_id,'paid_amount',v_paid,'debt_amount',greatest(0,v_payment.amount_due-v_paid));
end;
$$;

create or replace function public.rpc_create_tuition_adjustment(
  p_enrollment_id uuid,
  p_period_id uuid,
  p_type text,
  p_amount bigint,
  p_reason text,
  p_source_period_id uuid default null,
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
  if p_type not in ('DISCOUNT','CARRY_IN','CARRY_OUT','OPENING_DEBT','MANUAL') or p_amount is null or p_amount < 0 or coalesce(trim(p_reason),'')='' then raise exception using message='VALIDATION_ERROR'; end if;
  if p_type in ('CARRY_IN','CARRY_OUT') and p_source_period_id is null then raise exception using message='VALIDATION_ERROR'; end if;
  if not exists (select 1 from public.accounting_periods p where p.id=p_period_id and p.center_id=public.current_center_id() and p.status='OPEN') then raise exception using message='PERIOD_NOT_OPEN'; end if;
  if p_source_period_id is not null and not exists (select 1 from public.accounting_periods p where p.id=p_source_period_id and p.center_id=public.current_center_id()) then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if not exists (select 1 from public.enrollments e join public.classes c on c.id=e.class_id where e.id=p_enrollment_id and c.center_id=public.current_center_id()) then raise exception using message='ENROLLMENT_NOT_FOUND'; end if;
  insert into public.tuition_adjustments(period_id,enrollment_id,type,amount,reason,source_period_id,created_by)
  values (p_period_id,p_enrollment_id,p_type,p_amount,p_reason,p_source_period_id,v_user) returning id into v_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'TUITION_ADJUSTMENT_CREATED','tuition_adjustment',v_id::text,
    jsonb_build_object('period_id',p_period_id,'enrollment_id',p_enrollment_id,'type',p_type,'amount',p_amount),p_trace_id);
  return jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.rpc_carry_over_period(
  p_from_period_id uuid,
  p_to_period_id uuid,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_from record;
  v_to record;
  v_ledger record;
  v_created int := 0;
  v_existing int := 0;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  select * into v_from from public.accounting_periods where id=p_from_period_id and center_id=public.current_center_id();
  select * into v_to from public.accounting_periods where id=p_to_period_id and center_id=public.current_center_id() for update;
  if not found or v_from.id is null then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if v_to.status <> 'OPEN' then raise exception using message='PERIOD_NOT_OPEN'; end if;
  for v_ledger in select l.* from public.tuition_ledgers l where l.period_id=p_from_period_id and l.debt_amount > 0 loop
    if exists (select 1 from public.tuition_adjustments a where a.period_id=p_to_period_id and a.enrollment_id=v_ledger.enrollment_id and a.type='CARRY_IN' and a.source_period_id=p_from_period_id) then
      v_existing := v_existing + 1;
    else
      insert into public.tuition_adjustments(period_id,enrollment_id,type,amount,reason,source_period_id,created_by)
      values (p_to_period_id,v_ledger.enrollment_id,'CARRY_IN',v_ledger.debt_amount,'Carry-over from period '||v_from.year||'-'||lpad(v_from.month::text,2,'0'),p_from_period_id,v_user);
      insert into public.tuition_adjustments(period_id,enrollment_id,type,amount,reason,source_period_id,created_by)
      values (p_from_period_id,v_ledger.enrollment_id,'CARRY_OUT',v_ledger.debt_amount,'Carried to period '||v_to.year||'-'||lpad(v_to.month::text,2,'0'),p_to_period_id,v_user)
      on conflict (period_id,enrollment_id,type,source_period_id) where source_period_id is not null do nothing;
      v_created := v_created + 1;
    end if;
  end loop;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PERIOD_CARRY_OVER','accounting_period',p_to_period_id::text,
    jsonb_build_object('from_period_id',p_from_period_id,'created',v_created,'existing',v_existing),p_trace_id);
  return jsonb_build_object('created',v_created,'existing',v_existing);
end;
$$;

create or replace function public.rpc_save_payroll_run(
  p_period_id uuid,
  p_items jsonb,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_period record;
  v_run record;
  v_policy record;
  v_item record;
  v_run_id uuid;
  v_total bigint := 0;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_accountant() then raise exception using message='FORBIDDEN'; end if;
  select * into v_period from public.accounting_periods where id=p_period_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if v_period.status='CLOSED' then raise exception using message='PERIOD_CLOSED'; end if;
  if v_period.status <> 'OPEN' or p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception using message='VALIDATION_ERROR'; end if;
  select * into v_policy from public.payroll_policies
  where center_id=public.current_center_id() and active=true
    and effective_from <= v_period.start_date
    and (effective_to is null or effective_to >= v_period.start_date)
  order by effective_from desc limit 1;
  if not found then raise exception using message='PAYROLL_POLICY_NOT_FOUND'; end if;
  select * into v_run from public.payroll_runs where period_id=p_period_id for update;
  if found and v_run.status in ('APPROVED','PAID') then raise exception using message='PAYROLL_ALREADY_APPROVED'; end if;
  if found then
    v_run_id := v_run.id;
    update public.payroll_runs set status='DRAFT',calculated_at=now(),version=version+1,total_amount=0 where id=v_run_id;
    delete from public.payroll_items where payroll_run_id=v_run_id;
  else
    insert into public.payroll_runs(period_id,status,total_amount,calculated_at,version) values (p_period_id,'DRAFT',0,now(),1) returning id into v_run_id;
  end if;
  for v_item in select * from jsonb_to_recordset(p_items) as x(
    staff_id uuid,class_id uuid,role text,class_revenue bigint,sessions_taught int,
    applied_percent numeric,base_amount bigint,bonus bigint,penalty bigint,final_amount bigint
  ) loop
    if v_item.staff_id is null or v_item.class_id is null or v_item.role is null
       or v_item.class_revenue is null or v_item.sessions_taught is null
       or v_item.applied_percent is null or v_item.base_amount is null
       or v_item.bonus is null or v_item.penalty is null or v_item.final_amount is null
       or v_item.class_revenue < 0 or v_item.sessions_taught < 0
       or v_item.final_amount < 0 or v_item.base_amount < 0 or v_item.bonus < 0 or v_item.penalty < 0
       or v_item.final_amount <> v_item.base_amount + v_item.bonus - v_item.penalty then
      raise exception using message='VALIDATION_ERROR';
    end if;
    if v_item.role not in ('MAIN_TEACHER','ASSISTANT') then raise exception using message='VALIDATION_ERROR'; end if;
    if not exists (
      select 1 from public.staff s
      where s.id=v_item.staff_id and s.center_id=public.current_center_id()
        and s.staff_type = case when v_item.role='ASSISTANT' then 'ASSISTANT'::public.staff_type else 'TEACHER'::public.staff_type end
    ) then raise exception using message='STAFF_NOT_FOUND'; end if;
    if not exists (select 1 from public.classes c where c.id=v_item.class_id and c.center_id=public.current_center_id()) then raise exception using message='CLASS_NOT_FOUND'; end if;
    if not exists (
      select 1 from public.class_assignments a
      where a.class_id=v_item.class_id and a.staff_id=v_item.staff_id
        and a.role=v_item.role::public.assignment_role
        and (a.period_id=p_period_id or a.period_id is null)
        and a.start_date <= v_period.end_date
        and (a.end_date is null or a.end_date >= v_period.start_date)
    ) then raise exception using message='CLASS_NOT_ASSIGNED'; end if;
    if v_item.applied_percent <> (case when v_item.role='ASSISTANT' then v_policy.assistant_percent else v_policy.teacher_percent end) then
      raise exception using message='VALIDATION_ERROR';
    end if;
    if v_item.final_amount > floor(v_item.class_revenue * v_policy.max_total_percent) then
      raise exception using message='PAYROLL_CAP_EXCEEDED';
    end if;
    v_total := v_total + v_item.final_amount;
    insert into public.payroll_items(payroll_run_id,staff_id,class_id,role,class_revenue,sessions_taught,applied_percent,base_amount,bonus,penalty,final_amount)
    values (v_run_id,v_item.staff_id,v_item.class_id,v_item.role::public.assignment_role,v_item.class_revenue,v_item.sessions_taught,v_item.applied_percent,v_item.base_amount,v_item.bonus,v_item.penalty,v_item.final_amount);
  end loop;
  if exists (
    select 1 from public.payroll_items
    where payroll_run_id=v_run_id
    group by class_id
    having min(class_revenue) <> max(class_revenue)
       or sum(final_amount) > floor(min(class_revenue) * v_policy.max_total_percent)
  ) then raise exception using message='PAYROLL_CAP_EXCEEDED'; end if;
  update public.payroll_runs set total_amount=v_total,calculated_at=now() where id=v_run_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PAYROLL_SAVED','payroll_run',v_run_id::text,
    jsonb_build_object('period_id',p_period_id,'total_amount',v_total),p_trace_id);
  return jsonb_build_object('payroll_run_id',v_run_id,'total_amount',v_total,'status','DRAFT');
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
  select r.* into v_run from public.payroll_runs r join public.accounting_periods p on p.id=r.period_id
  where r.id=p_payroll_run_id and p.center_id=public.current_center_id() for update;
  if not found then raise exception using message='PAYROLL_NOT_FOUND'; end if;
  if v_run.status <> 'DRAFT' then raise exception using message='PAYROLL_ALREADY_APPROVED'; end if;
  update public.payroll_runs set status='APPROVED',approved_at=now(),approved_by=v_user where id=p_payroll_run_id;
  insert into public.audit_logs(center_id,actor_user_id,action,resource_type,resource_id,after_data,trace_id)
  values (public.current_center_id(),v_user,'PAYROLL_APPROVED','payroll_run',p_payroll_run_id::text,jsonb_build_object('total_amount',v_run.total_amount),p_trace_id);
  return jsonb_build_object('payroll_run_id',p_payroll_run_id,'status','APPROVED');
end;
$$;

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
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using message='UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message='FORBIDDEN'; end if;
  select * into v_period from public.accounting_periods where id=p_period_id and center_id=public.current_center_id() for update;
  if not found then raise exception using message='PERIOD_NOT_FOUND'; end if;
  if v_period.status='CLOSED' then return jsonb_build_object('period_id',p_period_id,'status','CLOSED'); end if;
  if p_expected_version is null or v_period.version <> p_expected_version then raise exception using message='VERSION_CONFLICT'; end if;

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
  select coalesce((value_json->>'fund_percent')::numeric,0.10) into v_fund_percent from public.system_settings where center_id=public.current_center_id() and key='fund';
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
  -- Carry outstanding debt into the next open period atomically with closing.
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
    jsonb_build_object('profit_before_fund',v_profit,'fund_contribution',v_contribution,'distributable_profit',v_distributable),p_trace_id);
  return jsonb_build_object('period_id',p_period_id,'status','CLOSED','profit_before_fund',v_profit,'fund_contribution',v_contribution,'distributable_profit',v_distributable);
end;
$$;

create or replace view public.v_class_period_summary
with (security_invoker = true)
as
select c.id as class_id,c.center_id,c.code,c.name,c.grade,c.subject,p.id as period_id,p.year,p.month,
  count(distinct e.id) filter (where e.status='ACTIVE') as roster_count,
  count(distinct s.id) filter (where s.status <> 'CANCELLED') as session_count,
  coalesce(sum(l.amount_due),0)::bigint as total_due,
  coalesce(sum(l.paid_amount),0)::bigint as total_paid,
  coalesce(sum(l.debt_amount),0)::bigint as total_debt
from public.classes c
cross join public.accounting_periods p
left join public.enrollments e on e.class_id=c.id and e.enrolled_from <= p.end_date and (e.enrolled_to is null or e.enrolled_to >= p.start_date)
left join public.class_sessions s on s.class_id=c.id and s.period_id=p.id
left join public.tuition_ledgers l on l.enrollment_id=e.id and l.period_id=p.id
group by c.id,p.id;

create or replace view public.v_student_attendance_summary
with (security_invoker = true)
as
select e.student_id,e.class_id,s.period_id,
  count(*) filter (where a.status='PRESENT')::int as present_count,
  count(*) filter (where a.status='ABSENT')::int as absent_count,
  count(*) filter (where a.status='EXCUSED')::int as excused_count,
  count(a.id)::int as marked_count
from public.enrollments e join public.class_sessions s on s.class_id=e.class_id
left join public.attendance a on a.session_id=s.id and a.enrollment_id=e.id
group by e.student_id,e.class_id,s.period_id;

create or replace view public.v_student_evaluation_summary
with (security_invoker = true)
as
select e.student_id,e.class_id,s.period_id,
  avg(v.homework_score) as avg_homework,avg(v.understanding_score) as avg_understanding,avg(v.attitude_score) as avg_attitude,
  max(v.updated_at) as last_evaluated_at
from public.enrollments e join public.class_sessions s on s.class_id=e.class_id
join public.student_session_evaluations v on v.session_id=s.id and v.enrollment_id=e.id
group by e.student_id,e.class_id,s.period_id;

create or replace view public.v_tuition_period_summary
with (security_invoker = true)
as
select l.period_id,c.id as class_id,c.code,c.name,
  coalesce(sum(l.amount_due),0)::bigint total_due,coalesce(sum(l.paid_amount),0)::bigint total_paid,
  coalesce(sum(l.debt_amount),0)::bigint total_debt,count(l.id)::int ledger_count
from public.tuition_ledgers l join public.enrollments e on e.id=l.enrollment_id join public.classes c on c.id=e.class_id
group by l.period_id,c.id,c.code,c.name;

create or replace view public.v_finance_period_summary
with (security_invoker = true)
as
select p.id as period_id,p.center_id,
  coalesce((select sum(l.amount_due) from public.tuition_ledgers l where l.period_id=p.id),0)::bigint tuition_income,
  coalesce((select sum(t.amount) from public.financial_transactions t where t.period_id=p.id and t.type='INCOME' and t.voided_at is null),0)::bigint other_income,
  coalesce((select sum(t.amount) from public.financial_transactions t where t.period_id=p.id and t.type='EXPENSE' and t.voided_at is null),0)::bigint other_expense,
  coalesce((select sum(r.amount) from public.student_rewards r where r.period_id=p.id),0)::bigint student_rewards,
  coalesce((select pr.total_amount from public.payroll_runs pr where pr.period_id=p.id),0)::bigint payroll
from public.accounting_periods p;

grant execute on function public.rpc_generate_month_sessions(uuid,uuid,text) to authenticated;
grant execute on function public.rpc_bulk_attendance(uuid,jsonb,text) to authenticated;
grant execute on function public.rpc_bulk_evaluation(uuid,jsonb,text) to authenticated;
grant execute on function public.rpc_generate_tuition(uuid,uuid,text) to authenticated;
grant execute on function public.rpc_record_payment(uuid,bigint,timestamptz,public.payment_method,text,text,text) to authenticated;
grant execute on function public.rpc_void_payment(uuid,text,text) to authenticated;
grant execute on function public.rpc_create_tuition_adjustment(uuid,uuid,text,bigint,text,uuid,text) to authenticated;
grant execute on function public.rpc_carry_over_period(uuid,uuid,text) to authenticated;
grant execute on function public.rpc_save_payroll_run(uuid,jsonb,text) to authenticated;
grant execute on function public.rpc_approve_payroll(uuid,text) to authenticated;
grant execute on function public.rpc_close_period(uuid,bigint,text) to authenticated;
grant select on public.v_class_period_summary,public.v_student_attendance_summary,public.v_student_evaluation_summary,public.v_tuition_period_summary,public.v_finance_period_summary to authenticated;

commit;
