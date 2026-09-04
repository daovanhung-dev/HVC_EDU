begin;

-- These tables do not have an updated_at column. The original bulk trigger
-- registration included them, which made any update fail at runtime.
drop trigger if exists touch_updated_at on public.class_schedules;
drop trigger if exists touch_updated_at on public.payroll_policies;

commit;
