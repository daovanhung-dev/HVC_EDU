begin;

-- Class deletion is an audited Admin-only operation. Empty classes may be
-- physically removed; classes referenced by operational or financial history
-- are preserved and deactivated instead.
create or replace function public.rpc_delete_class(
  p_class_id uuid,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_class record;
  v_has_history boolean;
  v_disabled_schedules int := 0;
  v_disabled_period_configs int := 0;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;

  select * into v_class
  from public.classes
  where id = p_class_id and center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'CLASS_NOT_FOUND'; end if;

  select
    exists (select 1 from public.enrollments where class_id = p_class_id)
    or exists (select 1 from public.class_sessions where class_id = p_class_id)
    or exists (select 1 from public.class_assignments where class_id = p_class_id)
    or exists (select 1 from public.student_rewards where class_id = p_class_id)
    or exists (select 1 from public.financial_transactions where class_id = p_class_id)
    or exists (select 1 from public.payroll_items where class_id = p_class_id)
    or exists (select 1 from public.period_class_configs where class_id = p_class_id)
  into v_has_history;

  if v_has_history then
    update public.classes
    set status = 'INACTIVE', updated_at = now()
    where id = p_class_id;

    update public.class_schedules
    set active = false
    where class_id = p_class_id and active = true;
    get diagnostics v_disabled_schedules = row_count;

    update public.period_class_configs pc
    set active = false, updated_at = now()
    where pc.class_id = p_class_id
      and pc.active = true
      and exists (
        select 1 from public.accounting_periods p
        where p.id = pc.period_id and p.status <> 'CLOSED'
      );
    get diagnostics v_disabled_period_configs = row_count;

    insert into public.audit_logs(
      center_id, actor_user_id, action, resource_type, resource_id,
      before_data, after_data, trace_id
    )
    values (
      v_class.center_id, v_user, 'CLASS_DEACTIVATED', 'class', p_class_id::text,
      jsonb_build_object(
        'code', v_class.code, 'name', v_class.name, 'status', v_class.status,
        'reason', 'DELETE_REQUESTED'
      ),
      jsonb_build_object(
        'code', v_class.code, 'name', v_class.name, 'status', 'INACTIVE',
        'history_preserved', true,
        'disabled_schedules', v_disabled_schedules,
        'disabled_open_period_configs', v_disabled_period_configs
      ),
      p_trace_id
    );

    return jsonb_build_object(
      'class_id', p_class_id,
      'action', 'DEACTIVATED',
      'status', 'INACTIVE'
    );
  end if;

  delete from public.classes where id = p_class_id;

  insert into public.audit_logs(
    center_id, actor_user_id, action, resource_type, resource_id,
    before_data, after_data, trace_id
  )
  values (
    v_class.center_id, v_user, 'CLASS_DELETED', 'class', p_class_id::text,
    jsonb_build_object(
      'code', v_class.code, 'name', v_class.name, 'grade', v_class.grade,
      'subject', v_class.subject, 'standard_unit_fee', v_class.standard_unit_fee,
      'collection_method', v_class.collection_method, 'status', v_class.status
    ),
    jsonb_build_object('deleted', true, 'history_preserved', false),
    p_trace_id
  );

  return jsonb_build_object(
    'class_id', p_class_id,
    'action', 'DELETED',
    'status', 'DELETED'
  );
end;
$$;

revoke all on function public.rpc_delete_class(uuid, text) from public;
grant execute on function public.rpc_delete_class(uuid, text) to authenticated;

-- An inactive class must not receive new schedules through the Data API.
drop policy if exists schedules_admin_write on public.class_schedules;
create policy schedules_admin_write on public.class_schedules for all to authenticated
  using (
    public.is_admin()
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.center_id = public.current_center_id() and c.status = 'ACTIVE'
    )
  )
  with check (
    public.is_admin()
    and exists (
      select 1 from public.classes c
      where c.id = class_id and c.center_id = public.current_center_id() and c.status = 'ACTIVE'
    )
  );

-- Do not generate new sessions or tuition for a class that was deactivated.
create or replace function public.rpc_generate_month_sessions(
  p_class_id uuid,
  p_period_id uuid,
  p_trace_id text default gen_random_uuid()::text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_period record;
  v_class record;
  v_date date;
  v_schedule record;
  v_created int := 0;
  v_existing int := 0;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  select * into v_class
  from public.classes
  where id = p_class_id and center_id = public.current_center_id() and status = 'ACTIVE';
  if not found then raise exception using message = 'CLASS_NOT_FOUND'; end if;
  select * into v_period
  from public.accounting_periods
  where id = p_period_id and center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'PERIOD_NOT_FOUND'; end if;
  if v_period.status <> 'OPEN' then raise exception using message = 'PERIOD_NOT_OPEN'; end if;
  if not exists (
    select 1 from public.period_class_configs
    where period_id = p_period_id and class_id = p_class_id and active = true
  ) then raise exception using message = 'CLASS_NOT_FOUND'; end if;

  v_date := v_period.start_date;
  while v_date <= v_period.end_date loop
    for v_schedule in
      select s.* from public.class_schedules s
      where s.class_id = p_class_id and s.active = true
        and s.weekday = extract(isodow from v_date)::smallint
        and s.effective_from <= v_date
        and (s.effective_to is null or s.effective_to >= v_date)
    loop
      if exists (
        select 1 from public.class_sessions cs
        where cs.class_id = p_class_id and cs.session_date = v_date
          and cs.start_time is not distinct from v_schedule.start_time
      ) then
        v_existing := v_existing + 1;
      else
        insert into public.class_sessions(
          class_id, period_id, session_date, start_time, end_time, status
        )
        values (
          p_class_id, p_period_id, v_date, v_schedule.start_time,
          v_schedule.end_time, 'SCHEDULED'
        );
        v_created := v_created + 1;
      end if;
    end loop;
    v_date := v_date + 1;
  end loop;

  insert into public.audit_logs(center_id, actor_user_id, action, resource_type, resource_id, after_data, trace_id)
  values (
    v_class.center_id, v_user, 'SESSIONS_GENERATED', 'class', p_class_id::text,
    jsonb_build_object('period_id', p_period_id, 'created', v_created, 'existing', v_existing),
    p_trace_id
  );
  return jsonb_build_object('created', v_created, 'existing', v_existing);
end;
$$;

grant execute on function public.rpc_generate_month_sessions(uuid, uuid, text) to authenticated;

commit;
