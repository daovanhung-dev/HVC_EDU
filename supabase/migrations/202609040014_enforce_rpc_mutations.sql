begin;

-- Consequential master/enrollment mutations must use the audited RPCs.
drop policy if exists classes_admin_update on public.classes;
drop policy if exists students_admin_update on public.students;
drop policy if exists staff_admin_write on public.staff;
drop policy if exists enrollment_admin_write on public.enrollments;

revoke insert, update, delete on public.classes from authenticated;
revoke insert, update, delete on public.students from authenticated;
revoke insert, update, delete on public.staff from authenticated;
revoke insert, update, delete on public.enrollments from authenticated;

commit;
