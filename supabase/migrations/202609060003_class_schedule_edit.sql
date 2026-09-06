begin;

-- Schedule changes are versioned so historical sessions keep their original
-- weekly schedule. Changes to an already-effective row create a new version
-- from the selected effective date instead of rewriting the old row.
create or replace function public.rpc_save_class_schedule(
  p_class_id uuid,
  p_schedule_id uuid,
  p_weekday int,
  p_start_time time,
  p_end_time time,
  p_effective_from date,
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
  v_before record;
  v_schedule_id uuid;
  v_effective_from date := p_effective_from;
  v_versioned boolean := false;
begin
  if v_user is null then raise exception using message = 'UNAUTHENTICATED'; end if;
  if not public.is_admin() then raise exception using message = 'FORBIDDEN'; end if;
  if p_class_id is null or p_weekday is null or p_weekday not between 1 and 7
     or p_effective_from is null
     or (p_end_time is not null and p_start_time is null)
     or (p_start_time is not null and p_end_time is not null and p_end_time <= p_start_time) then
    raise exception using message = 'VALIDATION_ERROR';
  end if;

  select id, center_id, code, status
  into v_class
  from public.classes
  where id = p_class_id
    and center_id = public.current_center_id()
  for update;
  if not found then raise exception using message = 'CLASS_NOT_FOUND'; end if;
  if v_class.status <> 'ACTIVE' then raise exception using message = 'CLASS_INACTIVE'; end if;
  if p_schedule_id is not null then
    v_effective_from := greatest(v_effective_from, current_date);
  end if;

  if p_schedule_id is null then
    if p_effective_from < current_date then
      raise exception using message = 'SCHEDULE_EFFECTIVE_DATE_PAST';
    end if;
    insert into public.class_schedules(
      class_id, weekday, start_time, end_time, effective_from, active
    )
    values (
      p_class_id, p_weekday, p_start_time, p_end_time, p_effective_from, true
    )
    returning id into v_schedule_id;
  else
    select *
    into v_before
    from public.class_schedules
    where id = p_schedule_id
      and class_id = p_class_id
    for update;
    if not found then raise exception using message = 'SCHEDULE_NOT_FOUND'; end if;

    -- Never rewrite a schedule that was already effective in the past. A
    -- change effective today closes that version yesterday; a future change
    -- keeps the old version active until the new version starts.
    if v_before.effective_from <= current_date and v_effective_from > current_date then
      update public.class_schedules
      set effective_to = v_effective_from - 1,
          active = true
      where id = p_schedule_id;
      v_versioned := true;
    elsif v_before.effective_from < current_date then
      v_effective_from := greatest(v_effective_from, current_date);
      update public.class_schedules
      set effective_to = v_effective_from - 1,
          active = false
      where id = p_schedule_id;
      v_versioned := true;
    else
      update public.class_schedules
      set weekday = p_weekday,
          start_time = p_start_time,
          end_time = p_end_time,
          effective_from = v_effective_from,
          active = true
      where id = p_schedule_id;
      v_schedule_id := p_schedule_id;
    end if;

    if v_versioned then
      insert into public.class_schedules(
        class_id, weekday, start_time, end_time, effective_from, active
      )
      values (
        p_class_id, p_weekday, p_start_time, p_end_time, v_effective_from, true
      )
      returning id into v_schedule_id;
    end if;
  end if;

  insert into public.audit_logs(
    center_id, actor_user_id, action, resource_type, resource_id,
    before_data, after_data, trace_id
  )
  values (
    v_class.center_id,
    v_user,
    case when p_schedule_id is null then 'CLASS_SCHEDULE_CREATED' else 'CLASS_SCHEDULE_UPDATED' end,
    'class_schedule',
    v_schedule_id::text,
    case when p_schedule_id is null then null else jsonb_build_object(
      'id', v_before.id,
      'weekday', v_before.weekday,
      'start_time', v_before.start_time,
      'end_time', v_before.end_time,
      'effective_from', v_before.effective_from,
      'effective_to', v_before.effective_to,
      'active', v_before.active
    ) end,
    jsonb_build_object(
      'id', v_schedule_id,
      'class_id', p_class_id,
      'class_code', v_class.code,
      'weekday', p_weekday,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'effective_from', v_effective_from,
      'active', true,
      'versioned', v_versioned
    ),
    p_trace_id
  );

  return jsonb_build_object(
    'schedule_id', v_schedule_id,
    'versioned', v_versioned,
    'effective_from', v_effective_from
  );
end;
$$;

revoke all on function public.rpc_save_class_schedule(uuid, uuid, int, time, time, date, text) from public;
grant execute on function public.rpc_save_class_schedule(uuid, uuid, int, time, time, date, text) to authenticated;

-- All browser schedule mutations now go through the audited RPC. Security
-- definer workflows/imports can still insert schedule rows as the owner.
revoke insert, update, delete on public.class_schedules from authenticated;

commit;
