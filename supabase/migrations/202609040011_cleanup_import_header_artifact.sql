begin;

-- A previous parser revision treated the QUY_CHIA header as a recipient.
-- Remove only that impossible zero-value header artifact.
delete from public.profit_distributions
where recipient_name = 'Người nhận'
  and ratio = 0
  and amount = 0;

commit;
