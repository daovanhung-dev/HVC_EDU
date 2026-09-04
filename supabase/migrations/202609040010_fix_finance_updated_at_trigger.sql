begin;

drop trigger if exists touch_updated_at on public.financial_transactions;

commit;
