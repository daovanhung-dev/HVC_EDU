-- Optional seed based on the August workbook snapshot. Remove if you want an empty production database.
insert into public.classes(center_id, code, name, grade, subject, standard_unit_fee, collection_method)
select c.id, v.code, v.name, v.grade, 'Toán', v.fee, v.method::public.collection_method
from public.centers c
cross join (values
  ('L06','Toán 6',6,50000::bigint,'PER_SESSION'),
  ('L07','Toán 7',7,50000::bigint,'PER_SESSION'),
  ('L08','Toán 8',8,50000::bigint,'PER_SESSION'),
  ('L09','Toán 9',9,60000::bigint,'PREPAID')
) as v(code,name,grade,fee,method)
where c.code='HC'
on conflict(center_id, code) do nothing;
