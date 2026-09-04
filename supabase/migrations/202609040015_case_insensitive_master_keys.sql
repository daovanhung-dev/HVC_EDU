begin;

create unique index if not exists classes_center_code_lower_uq
  on public.classes(center_id, lower(code));

create unique index if not exists staff_center_code_lower_uq
  on public.staff(center_id, lower(code));

commit;
