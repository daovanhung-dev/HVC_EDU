begin;

drop table if exists public.system_settings cascade;

drop type if exists public.collection_method cascade;
drop type if exists public.ledger_status cascade;
drop type if exists public.payment_method cascade;
drop type if exists public.payroll_status cascade;
drop type if exists public.period_status cascade;
drop type if exists public.work_attendance_status cascade;

commit;
