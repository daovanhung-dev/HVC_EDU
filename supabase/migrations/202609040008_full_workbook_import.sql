begin;

-- Source provenance/idempotency for normalized workbook facts. These columns
-- are nullable so existing application-created records remain unchanged.
alter table public.tuition_adjustments add column if not exists source_key text;
alter table public.payments add column if not exists source_key text;
alter table public.student_rewards add column if not exists source_key text;
alter table public.financial_transactions add column if not exists source_key text;
alter table public.payroll_runs add column if not exists source_key text;
alter table public.payroll_runs add column if not exists source_snapshot jsonb;

create unique index if not exists tuition_adjustments_source_key_uq
  on public.tuition_adjustments(period_id, source_key)
  where source_key is not null;
create unique index if not exists payments_source_key_uq
  on public.payments(tuition_ledger_id, source_key)
  where source_key is not null;
create unique index if not exists student_rewards_source_key_uq
  on public.student_rewards(period_id, source_key)
  where source_key is not null;
create unique index if not exists financial_transactions_source_key_uq
  on public.financial_transactions(period_id, source_key)
  where source_key is not null;

create or replace function public.rpc_import_normalized_workbook(
  p_import_job_id uuid,
  p_payload jsonb,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_item record;
  v_nested record;
  v_existing record;
  v_period record;
  v_run record;
  v_period_id uuid;
  v_class_id uuid;
  v_staff_id uuid;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_session_id uuid;
  v_ledger_id uuid;
  v_schedule_id uuid;
  v_assignment_id uuid;
  v_adjustment_id uuid;
  v_payment_id uuid;
  v_reward_id uuid;
  v_finance_id uuid;
  v_run_id uuid;
  v_user uuid := auth.uid();
  v_classes int := 0;
  v_staff_count int := 0;
  v_students int := 0;
  v_enrollments int := 0;
  v_sessions int := 0;
  v_attendance int := 0;
  v_evaluations int := 0;
  v_ledgers int := 0;
  v_payments int := 0;
  v_adjustments int := 0;
  v_rewards int := 0;
  v_finance int := 0;
  v_payroll_items int := 0;
  v_fund int := 0;
  v_distributions int := 0;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception using message = 'VALIDATION_ERROR'; end if;

  select * into v_job
  from public.import_jobs
  where id = p_import_job_id and center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'NOT_FOUND'; end if;
  if v_job.status = 'COMPLETED' then
    return coalesce(v_job.summary->'imported', '{}'::jsonb);
  end if;

  update public.import_jobs
  set status = 'IMPORTING', started_at = coalesce(started_at, now()), updated_at = now(), error_message = null
  where id = p_import_job_id;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'periods', '[]'::jsonb)) as x(year int, month int, start_date date, end_date date) loop
    if v_item.year not between 2020 and 2100 or v_item.month not between 1 and 12 or v_item.end_date < v_item.start_date then
      raise exception using message = 'IMPORT_VALIDATION_FAILED';
    end if;
    insert into public.accounting_periods(center_id, year, month, start_date, end_date, status)
    values (public.current_center_id(), v_item.year, v_item.month, v_item.start_date, v_item.end_date, 'OPEN')
    on conflict (center_id, year, month) do update
      set start_date = excluded.start_date, end_date = excluded.end_date, updated_at = now()
      where public.accounting_periods.status <> 'CLOSED';
    select id into v_period_id
    from public.accounting_periods
    where center_id = public.current_center_id()
      and year = v_item.year and month = v_item.month;
  end loop;

  if v_period_id is null then raise exception using message = 'PERIOD_NOT_FOUND'; end if;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'settings', '[]'::jsonb)) as x(key text, value_json jsonb) loop
    if coalesce(trim(v_item.key), '') <> '' then
      insert into public.system_settings(center_id, key, value_json, updated_by, updated_at)
      values (public.current_center_id(), trim(v_item.key), coalesce(v_item.value_json, '{}'::jsonb), v_user, now())
      on conflict (center_id, key) do update set value_json = excluded.value_json, updated_by = v_user, updated_at = now();
    end if;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'classes', '[]'::jsonb)) as x(code text, name text, grade int, subject text, standard_unit_fee bigint, collection_method text, status text, note text, schedules jsonb) loop
    if coalesce(trim(v_item.code), '') = '' or coalesce(trim(v_item.name), '') = '' or v_item.grade not between 1 and 12 or coalesce(v_item.standard_unit_fee, 0) < 0 or v_item.collection_method not in ('PER_SESSION', 'PREPAID') then
      raise exception using message = 'IMPORT_VALIDATION_FAILED';
    end if;
    insert into public.classes(center_id, code, name, grade, subject, standard_unit_fee, collection_method, status, note)
    values (public.current_center_id(), trim(v_item.code), trim(v_item.name), v_item.grade, coalesce(nullif(trim(v_item.subject), ''), 'Toán'), v_item.standard_unit_fee, v_item.collection_method::public.collection_method, coalesce(v_item.status, 'ACTIVE')::public.entity_status, nullif(trim(v_item.note), ''))
    on conflict (center_id, code) do update set name = excluded.name, grade = excluded.grade, subject = excluded.subject, standard_unit_fee = excluded.standard_unit_fee, collection_method = excluded.collection_method, status = excluded.status, note = excluded.note, updated_at = now()
    returning id into v_class_id;
    v_classes := v_classes + 1;
    for v_nested in select * from jsonb_to_recordset(coalesce(v_item.schedules, '[]'::jsonb)) as x(weekday int, start_time time, end_time time) loop
      if v_nested.weekday not between 1 and 7 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
      select id into v_schedule_id from public.class_schedules where class_id = v_class_id and weekday = v_nested.weekday and effective_from = (select start_date from public.accounting_periods where id = v_period_id);
      if v_schedule_id is null then
        insert into public.class_schedules(class_id, weekday, start_time, end_time, effective_from) values (v_class_id, v_nested.weekday, v_nested.start_time, v_nested.end_time, (select start_date from public.accounting_periods where id = v_period_id));
      else
        update public.class_schedules set start_time = v_nested.start_time, end_time = v_nested.end_time, active = true where id = v_schedule_id;
      end if;
    end loop;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'staff', '[]'::jsonb)) as x(code text, full_name text, staff_type text, phone text, primary_subject text, status text, note text) loop
    if coalesce(trim(v_item.code), '') = '' or coalesce(trim(v_item.full_name), '') = '' or v_item.staff_type not in ('TEACHER', 'ASSISTANT') then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    insert into public.staff(center_id, code, full_name, staff_type, phone, primary_subject, status, note)
    values (public.current_center_id(), trim(v_item.code), trim(v_item.full_name), v_item.staff_type::public.staff_type, nullif(trim(v_item.phone), ''), nullif(trim(v_item.primary_subject), ''), coalesce(v_item.status, 'ACTIVE')::public.entity_status, nullif(trim(v_item.note), ''))
    on conflict (center_id, code) do update set full_name = excluded.full_name, staff_type = excluded.staff_type, phone = excluded.phone, primary_subject = excluded.primary_subject, status = excluded.status, note = excluded.note, updated_at = now();
    v_staff_count := v_staff_count + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'assignments', '[]'::jsonb)) as x(class_code text, staff_code text, role text, planned_sessions int, start_date date, end_date date) loop
    select c.id into v_class_id from public.classes c where c.center_id = public.current_center_id() and c.code = trim(v_item.class_code);
    select s.id into v_staff_id from public.staff s where s.center_id = public.current_center_id() and s.code = trim(v_item.staff_code);
    if v_class_id is null or v_staff_id is null or v_item.role not in ('MAIN_TEACHER', 'ASSISTANT') then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and start_date <= v_item.start_date and (end_date is null or end_date >= v_item.start_date) order by start_date desc limit 1;
    select id into v_assignment_id from public.class_assignments where class_id = v_class_id and staff_id = v_staff_id and role = v_item.role::public.assignment_role and period_id = v_period_id;
    if v_assignment_id is null then
      select id into v_assignment_id from public.class_assignments where class_id = v_class_id and staff_id = v_staff_id and role = v_item.role::public.assignment_role and period_id is null;
      if v_assignment_id is not null then update public.class_assignments set period_id = v_period_id, planned_sessions = v_item.planned_sessions, start_date = v_item.start_date, end_date = v_item.end_date where id = v_assignment_id;
      else insert into public.class_assignments(class_id, staff_id, period_id, role, planned_sessions, start_date, end_date) values (v_class_id, v_staff_id, v_period_id, v_item.role::public.assignment_role, v_item.planned_sessions, v_item.start_date, v_item.end_date); end if;
    else update public.class_assignments set planned_sessions = v_item.planned_sessions, start_date = v_item.start_date, end_date = v_item.end_date where id = v_assignment_id;
    end if;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'students', '[]'::jsonb)) as x(code text, full_name text, phone text, parent_name text, parent_phone text, note text, class_code text, enrolled_from date, unit_price_override bigint) loop
    if coalesce(trim(v_item.code), '') = '' or coalesce(trim(v_item.full_name), '') = '' or v_item.unit_price_override < 0 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    insert into public.students(center_id, code, full_name, phone, parent_name, parent_phone, note)
    values (public.current_center_id(), trim(v_item.code), trim(v_item.full_name), nullif(trim(v_item.phone), ''), nullif(trim(v_item.parent_name), ''), nullif(trim(v_item.parent_phone), ''), nullif(trim(v_item.note), ''))
    on conflict (center_id, code) do update set full_name = excluded.full_name, phone = excluded.phone, parent_name = excluded.parent_name, parent_phone = excluded.parent_phone, note = excluded.note, updated_at = now()
    returning id into v_student_id;
    v_students := v_students + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'enrollments', '[]'::jsonb)) as x(student_code text, class_code text, enrolled_from date, enrolled_to date, unit_price_override bigint, tuition_exempt boolean, note text) loop
    select id into v_student_id from public.students where center_id = public.current_center_id() and code = trim(v_item.student_code);
    select id into v_class_id from public.classes where center_id = public.current_center_id() and code = trim(v_item.class_code);
    if v_student_id is null or v_class_id is null then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select id into v_enrollment_id from public.enrollments where student_id = v_student_id and class_id = v_class_id and enrolled_from = v_item.enrolled_from limit 1;
    if v_enrollment_id is null then insert into public.enrollments(student_id, class_id, enrolled_from, enrolled_to, unit_price_override, tuition_exempt, note) values (v_student_id, v_class_id, v_item.enrolled_from, v_item.enrolled_to, v_item.unit_price_override, coalesce(v_item.tuition_exempt, false), v_item.note) returning id into v_enrollment_id;
    else update public.enrollments set enrolled_to = v_item.enrolled_to, unit_price_override = v_item.unit_price_override, tuition_exempt = coalesce(v_item.tuition_exempt, false), note = v_item.note, status = 'ACTIVE', updated_at = now() where id = v_enrollment_id; end if;
    v_enrollments := v_enrollments + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'sessions', '[]'::jsonb)) as x(class_code text, year int, month int, session_date date, status text, teacher_code text, note text) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month;
    select id into v_class_id from public.classes where center_id = public.current_center_id() and code = trim(v_item.class_code);
    select id into v_staff_id from public.staff where center_id = public.current_center_id() and code = nullif(trim(v_item.teacher_code), '');
    if v_period_id is null or v_class_id is null then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select id into v_session_id from public.class_sessions where class_id = v_class_id and period_id = v_period_id and session_date = v_item.session_date and start_time is null limit 1;
    if v_session_id is null then insert into public.class_sessions(class_id, period_id, session_date, status, teacher_id, note) values (v_class_id, v_period_id, v_item.session_date, v_item.status::public.session_status, v_staff_id, v_item.note) returning id into v_session_id;
    else update public.class_sessions set status = v_item.status::public.session_status, teacher_id = v_staff_id, note = v_item.note, updated_at = now() where id = v_session_id; end if;
    v_sessions := v_sessions + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'attendance', '[]'::jsonb)) as x(class_code text, student_code text, session_date date, status text, note text) loop
    select s.id into v_session_id from public.class_sessions s join public.classes c on c.id = s.class_id where c.center_id = public.current_center_id() and c.code = trim(v_item.class_code) and s.session_date = v_item.session_date and s.period_id = (select id from public.accounting_periods where center_id = public.current_center_id() and s.session_date between start_date and end_date limit 1);
    select e.id into v_enrollment_id from public.enrollments e join public.students st on st.id = e.student_id join public.classes c on c.id = e.class_id where st.center_id = public.current_center_id() and st.code = trim(v_item.student_code) and c.code = trim(v_item.class_code) and e.status = 'ACTIVE' limit 1;
    if v_session_id is null or v_enrollment_id is null then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    insert into public.attendance(session_id, enrollment_id, status, note, marked_by, marked_at, updated_at) values (v_session_id, v_enrollment_id, v_item.status::public.attendance_status, v_item.note, v_user, now(), now()) on conflict (session_id, enrollment_id) do update set status = excluded.status, note = excluded.note, marked_by = v_user, marked_at = now(), updated_at = now();
    v_attendance := v_attendance + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'evaluations', '[]'::jsonb)) as x(class_code text, student_code text, session_date date, homework_score numeric, understanding_score numeric, attitude_score numeric, learning_gap text, comment text) loop
    select s.id into v_session_id from public.class_sessions s join public.classes c on c.id = s.class_id where c.center_id = public.current_center_id() and c.code = trim(v_item.class_code) and s.session_date = v_item.session_date limit 1;
    select e.id into v_enrollment_id from public.enrollments e join public.students st on st.id = e.student_id join public.classes c on c.id = e.class_id where st.center_id = public.current_center_id() and st.code = trim(v_item.student_code) and c.code = trim(v_item.class_code) and e.status = 'ACTIVE' limit 1;
    if v_session_id is null or v_enrollment_id is null then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    insert into public.student_session_evaluations(session_id, enrollment_id, homework_score, understanding_score, attitude_score, learning_gap, comment, created_by, updated_at) values (v_session_id, v_enrollment_id, v_item.homework_score, v_item.understanding_score, v_item.attitude_score, v_item.learning_gap, v_item.comment, v_user, now()) on conflict (session_id, enrollment_id) do update set homework_score = excluded.homework_score, understanding_score = excluded.understanding_score, attitude_score = excluded.attitude_score, learning_gap = excluded.learning_gap, comment = excluded.comment, updated_at = now();
    v_evaluations := v_evaluations + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'adjustments', '[]'::jsonb)) as x(class_code text, student_code text, year int, month int, type text, amount bigint, reason text, source_key text) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; select id into v_student_id from public.students where center_id = public.current_center_id() and code = trim(v_item.student_code); select e.id into v_enrollment_id from public.enrollments e join public.classes c on c.id = e.class_id where e.student_id = v_student_id and c.center_id = public.current_center_id() and c.code = trim(v_item.class_code) and e.status = 'ACTIVE' limit 1;
    if v_period_id is null or v_enrollment_id is null or v_item.amount is null or v_item.amount <= 0 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select id into v_adjustment_id from public.tuition_adjustments where period_id = v_period_id and source_key = v_item.source_key;
    if v_adjustment_id is null then insert into public.tuition_adjustments(period_id, enrollment_id, type, amount, reason, created_by, source_key) values (v_period_id, v_enrollment_id, v_item.type, v_item.amount, v_item.reason, v_user, v_item.source_key); else update public.tuition_adjustments set enrollment_id = v_enrollment_id, type = v_item.type, amount = v_item.amount, reason = v_item.reason where id = v_adjustment_id; end if;
    v_adjustments := v_adjustments + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'tuition_ledgers', '[]'::jsonb)) as x(class_code text, student_code text, year int, month int, attended_sessions int, absent_sessions int, billable_sessions int, unit_price bigint, gross_amount bigint, opening_debt bigint, adjustment_amount bigint, amount_due bigint, paid_amount bigint, debt_amount bigint, status text) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; select e.id into v_enrollment_id from public.enrollments e join public.students st on st.id = e.student_id join public.classes c on c.id = e.class_id where st.center_id = public.current_center_id() and st.code = trim(v_item.student_code) and c.code = trim(v_item.class_code) and e.status = 'ACTIVE' limit 1;
    if v_period_id is null or v_enrollment_id is null or v_item.amount_due < 0 or v_item.paid_amount < 0 or v_item.debt_amount < 0 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select l.* into v_existing from public.tuition_ledgers l where l.period_id = v_period_id and l.enrollment_id = v_enrollment_id for update;
    if found and v_existing.status in ('PAID', 'PARTIAL', 'CONFIRMED') and (v_existing.amount_due <> v_item.amount_due or v_existing.paid_amount <> v_item.paid_amount or v_existing.debt_amount <> v_item.debt_amount) then raise exception using message = 'IMPORT_CONFLICT'; end if;
    insert into public.tuition_ledgers(period_id, enrollment_id, attended_sessions, absent_sessions, billable_sessions, unit_price, gross_amount, opening_debt, adjustment_amount, amount_due, paid_amount, debt_amount, status, generated_at, updated_at) values (v_period_id, v_enrollment_id, v_item.attended_sessions, v_item.absent_sessions, v_item.billable_sessions, v_item.unit_price, v_item.gross_amount, v_item.opening_debt, v_item.adjustment_amount, v_item.amount_due, v_item.paid_amount, v_item.debt_amount, v_item.status::public.ledger_status, now(), now()) on conflict (period_id, enrollment_id) do update set attended_sessions = excluded.attended_sessions, absent_sessions = excluded.absent_sessions, billable_sessions = excluded.billable_sessions, unit_price = excluded.unit_price, gross_amount = excluded.gross_amount, opening_debt = excluded.opening_debt, adjustment_amount = excluded.adjustment_amount, amount_due = excluded.amount_due, paid_amount = excluded.paid_amount, debt_amount = excluded.debt_amount, status = excluded.status, updated_at = now();
    v_ledgers := v_ledgers + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'payments', '[]'::jsonb)) as x(class_code text, student_code text, year int, month int, amount bigint, paid_at timestamptz, method text, reference text, note text, source_key text) loop
    select l.id into v_ledger_id from public.tuition_ledgers l join public.enrollments e on e.id = l.enrollment_id join public.students st on st.id = e.student_id join public.classes c on c.id = e.class_id where c.center_id = public.current_center_id() and c.code = trim(v_item.class_code) and st.code = trim(v_item.student_code) and l.period_id = (select id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month) limit 1;
    if v_ledger_id is null or v_item.amount is null or v_item.amount <= 0 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select id into v_payment_id from public.payments where tuition_ledger_id = v_ledger_id and source_key = v_item.source_key;
    if v_payment_id is null then insert into public.payments(tuition_ledger_id, amount, paid_at, method, reference, note, created_by, source_key) values (v_ledger_id, v_item.amount, v_item.paid_at, v_item.method::public.payment_method, v_item.reference, v_item.note, v_user, v_item.source_key); else update public.payments set amount = v_item.amount, paid_at = v_item.paid_at, method = v_item.method::public.payment_method, reference = v_item.reference, note = v_item.note where id = v_payment_id and voided_at is null; end if;
    v_payments := v_payments + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'rewards', '[]'::jsonb)) as x(class_code text, student_code text, year int, month int, amount bigint, reason text, note text, source_key text) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; select id into v_student_id from public.students where center_id = public.current_center_id() and code = trim(v_item.student_code); select id into v_class_id from public.classes where center_id = public.current_center_id() and code = nullif(trim(v_item.class_code), '');
    if v_period_id is null or v_student_id is null or v_item.amount < 0 or coalesce(trim(v_item.reason), '') = '' then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select id into v_reward_id from public.student_rewards where period_id = v_period_id and source_key = v_item.source_key;
    if v_reward_id is null then insert into public.student_rewards(period_id, student_id, class_id, amount, reason, note, created_by, source_key) values (v_period_id, v_student_id, v_class_id, v_item.amount, v_item.reason, v_item.note, v_user, v_item.source_key); else update public.student_rewards set student_id = v_student_id, class_id = v_class_id, amount = v_item.amount, reason = v_item.reason, note = v_item.note where id = v_reward_id; end if;
    v_rewards := v_rewards + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'financial_transactions', '[]'::jsonb)) as x(year int, month int, transaction_date date, type text, category text, class_code text, description text, amount bigint, source_key text) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; select id into v_class_id from public.classes where center_id = public.current_center_id() and code = nullif(trim(v_item.class_code), '');
    if v_period_id is null or v_item.amount is null or v_item.amount <= 0 or coalesce(trim(v_item.category), '') = '' or coalesce(trim(v_item.description), '') = '' then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select id into v_finance_id from public.financial_transactions where period_id = v_period_id and source_key = v_item.source_key;
    if v_finance_id is null then insert into public.financial_transactions(period_id, transaction_date, type, category, class_id, description, amount, created_by, source_key) values (v_period_id, v_item.transaction_date, v_item.type::public.financial_transaction_type, v_item.category, v_class_id, v_item.description, v_item.amount, v_user, v_item.source_key); else update public.financial_transactions set transaction_date = v_item.transaction_date, type = v_item.type::public.financial_transaction_type, category = v_item.category, class_id = v_class_id, description = v_item.description, amount = v_item.amount where id = v_finance_id and voided_at is null; end if;
    v_finance := v_finance + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'payroll_runs', '[]'::jsonb)) as x(year int, month int, status text, total_amount bigint, source_key text, calculated_at timestamptz, approved_at timestamptz, source_snapshot jsonb) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; if v_period_id is null or v_item.total_amount < 0 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    select * into v_run from public.payroll_runs where period_id = v_period_id for update;
    if found and v_run.status = 'PAID' and v_run.source_key is distinct from v_item.source_key then raise exception using message = 'IMPORT_CONFLICT'; end if;
    insert into public.payroll_runs(period_id, status, total_amount, calculated_at, approved_at, approved_by, source_key, source_snapshot) values (v_period_id, v_item.status::public.payroll_status, v_item.total_amount, coalesce(v_item.calculated_at, now()), v_item.approved_at, case when v_item.approved_at is null then null else v_user end, v_item.source_key, v_item.source_snapshot) on conflict (period_id) do update set status = excluded.status, total_amount = excluded.total_amount, calculated_at = excluded.calculated_at, approved_at = excluded.approved_at, approved_by = excluded.approved_by, source_key = excluded.source_key, source_snapshot = excluded.source_snapshot, version = public.payroll_runs.version + 1 returning id into v_run_id;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'payroll_items', '[]'::jsonb)) as x(year int, month int, staff_code text, class_code text, role text, class_revenue bigint, sessions_taught int, applied_percent numeric, base_amount bigint, bonus bigint, penalty bigint, final_amount bigint) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; select id into v_staff_id from public.staff where center_id = public.current_center_id() and code = trim(v_item.staff_code); select id into v_class_id from public.classes where center_id = public.current_center_id() and code = trim(v_item.class_code); select id into v_run_id from public.payroll_runs where period_id = v_period_id;
    if v_period_id is null or v_staff_id is null or v_class_id is null or v_run_id is null or v_item.final_amount <> v_item.base_amount + v_item.bonus - v_item.penalty then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    insert into public.payroll_items(payroll_run_id, staff_id, class_id, role, class_revenue, sessions_taught, applied_percent, base_amount, bonus, penalty, final_amount) values (v_run_id, v_staff_id, v_class_id, v_item.role::public.assignment_role, v_item.class_revenue, v_item.sessions_taught, v_item.applied_percent, v_item.base_amount, v_item.bonus, v_item.penalty, v_item.final_amount) on conflict (payroll_run_id, staff_id, class_id, role) do update set class_revenue = excluded.class_revenue, sessions_taught = excluded.sessions_taught, applied_percent = excluded.applied_percent, base_amount = excluded.base_amount, bonus = excluded.bonus, penalty = excluded.penalty, final_amount = excluded.final_amount;
    v_payroll_items := v_payroll_items + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'fund_entries', '[]'::jsonb)) as x(year int, month int, type text, amount bigint, note text) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; if v_period_id is null or v_item.amount < 0 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    insert into public.fund_ledger(period_id, type, amount, note, created_by) values (v_period_id, v_item.type, v_item.amount, coalesce(v_item.note, ''), v_user) on conflict (period_id, type) do update set amount = excluded.amount, note = excluded.note;
    v_fund := v_fund + 1;
  end loop;

  for v_item in select * from jsonb_to_recordset(coalesce(p_payload->'profit_distributions', '[]'::jsonb)) as x(year int, month int, recipient_name text, ratio numeric, amount bigint) loop
    select id into v_period_id from public.accounting_periods where center_id = public.current_center_id() and year = v_item.year and month = v_item.month; if v_period_id is null or coalesce(trim(v_item.recipient_name), '') = '' or v_item.ratio < 0 or v_item.ratio > 1 or v_item.amount < 0 then raise exception using message = 'IMPORT_VALIDATION_FAILED'; end if;
    insert into public.profit_distributions(period_id, recipient_name, ratio, amount) values (v_period_id, v_item.recipient_name, v_item.ratio, v_item.amount) on conflict (period_id, recipient_name) do update set ratio = excluded.ratio, amount = excluded.amount;
    v_distributions := v_distributions + 1;
  end loop;

  update public.import_jobs
  set summary = coalesce(summary, '{}'::jsonb) || jsonb_build_object('imported', jsonb_build_object('classes', v_classes, 'staff', v_staff_count, 'students', v_students, 'enrollments', v_enrollments, 'sessions', v_sessions, 'attendance', v_attendance, 'evaluations', v_evaluations, 'tuition_ledgers', v_ledgers, 'payments', v_payments, 'adjustments', v_adjustments, 'rewards', v_rewards, 'financial_transactions', v_finance, 'payroll_items', v_payroll_items, 'fund_entries', v_fund, 'profit_distributions', v_distributions)), status = 'COMPLETED', completed_at = now(), updated_at = now(), error_message = null
  where id = p_import_job_id;
  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (public.current_center_id(), v_user, 'WORKBOOK_IMPORTED_FULL', 'import_job', p_import_job_id::text, jsonb_build_object('classes', v_classes, 'staff', v_staff_count, 'students', v_students, 'enrollments', v_enrollments, 'sessions', v_sessions, 'attendance', v_attendance, 'evaluations', v_evaluations, 'tuition_ledgers', v_ledgers, 'payments', v_payments, 'adjustments', v_adjustments, 'rewards', v_rewards, 'financial_transactions', v_finance, 'payroll_items', v_payroll_items, 'fund_entries', v_fund, 'profit_distributions', v_distributions), p_trace_id);
  return jsonb_build_object('classes', v_classes, 'staff', v_staff_count, 'students', v_students, 'enrollments', v_enrollments, 'sessions', v_sessions, 'attendance', v_attendance, 'evaluations', v_evaluations, 'tuition_ledgers', v_ledgers, 'payments', v_payments, 'adjustments', v_adjustments, 'rewards', v_rewards, 'financial_transactions', v_finance, 'payroll_items', v_payroll_items, 'fund_entries', v_fund, 'profit_distributions', v_distributions);
end;
$$;

grant execute on function public.rpc_import_normalized_workbook(uuid, jsonb, text) to authenticated;

commit;
