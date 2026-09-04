begin;

-- Migration 004 is already present in production. Recreate the affected
-- functions with explicit enum casts so PostgreSQL type-checks every branch.

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
        amount_due=v_due,paid_amount=v_paid,debt_amount=greatest(0,v_due-v_paid),status=(case when v_paid >= v_due then 'PAID' when v_paid > 0 then 'PARTIAL' else 'CONFIRMED' end)::public.ledger_status,updated_at=now()
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

commit;
