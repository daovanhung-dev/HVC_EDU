-- 1) Create an Auth user first in Supabase Dashboard / Auth.
-- 2) Replace USER_UUID below, then run this script once.
insert into public.profiles(user_id, center_id, full_name, role, active)
select
  'USER_UUID'::uuid,
  c.id,
  'Administrator',
  'ADMIN'::public.app_role,
  true
from public.centers c
where c.code = 'HC'
on conflict(user_id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    active = true;
