begin;

create or replace function public.rpc_dashboard_summary(p_from_date date, p_to_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with visible_classes as (
    select c.id
    from public.classes c
    where c.center_id = public.current_center_id()
      and c.status = 'ACTIVE'
      and public.has_class_assignment(c.id)
  ),
  visible_students as (
    select distinct st.id
    from public.students st
    join public.enrollments e on e.student_id = st.id and e.status = 'ACTIVE'
    where st.center_id = public.current_center_id()
      and (public.is_admin() or e.class_id in (select id from visible_classes))
  ),
  money as (
    select coalesce(sum(amount) filter (where type = 'INCOME'), 0)::bigint as income,
           coalesce(sum(amount) filter (where type = 'EXPENSE'), 0)::bigint as expense
    from public.financial_transactions
    where center_id = public.current_center_id()
      and public.is_admin()
      and transaction_date between coalesce(p_from_date, date_trunc('month', current_date)::date)
        and coalesce(p_to_date, current_date)
  )
  select jsonb_build_object(
    'from_date', coalesce(p_from_date, date_trunc('month', current_date)::date),
    'to_date', coalesce(p_to_date, current_date),
    'active_classes', (select count(*) from visible_classes),
    'active_students', (select count(*) from visible_students),
    'active_staff', (select count(*) from public.staff where center_id = public.current_center_id() and status = 'ACTIVE' and (public.is_admin() or id = public.current_staff_id())),
    'sessions', (select count(*) from public.class_sessions s where s.session_date between coalesce(p_from_date, date_trunc('month', current_date)::date) and coalesce(p_to_date, current_date) and (public.is_admin() or public.has_class_assignment(s.class_id, s.session_date))),
    'income', (select income from money),
    'expense', (select expense from money),
    'balance', (select income - expense from money),
    'role', public.current_app_role()
  );
$$;

commit;
