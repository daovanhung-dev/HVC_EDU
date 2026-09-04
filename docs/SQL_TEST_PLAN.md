# Supabase business/RLS smoke plan

Run after `supabase start` and `supabase db reset` with two centers and four test users (`ADMIN_A`, `ADMIN_B`, `TEACHER_A`, `ACCOUNTANT_A`) bootstrapped in `profiles`. The assertions below are intentionally kept as a reviewable checklist because this runner has no Docker/Podman database.

1. `DB-T01` — authenticate a center-A user and verify `classes`, `students`, `enrollments`, finance views and `audit_logs` never return center-B rows.
2. `DB-T02` — assign `TEACHER_A` to class A1 only; verify class A1 roster/session/attendance/evaluation is readable and class A2 is not.
3. `DB-T03` — verify teacher/assistant cannot select `tuition_ledgers`, `payments`, payroll, rewards or other finance data.
4. `DB-T04` — call `rpc_generate_month_sessions` twice and verify the second result has no new rows; call attendance/evaluation twice and verify `(session_id,enrollment_id)` remains unique.
5. `DB-T05` — call `rpc_generate_tuition` twice and verify `(period_id,enrollment_id)` remains unique and confirmed/paid ledgers are unchanged.
6. `DB-T06` — close a period, then verify payment, adjustment, finance transaction, reward and tuition generation return `PERIOD_CLOSED`/`PERIOD_NOT_OPEN`.
7. `DB-T07` — record a payment and verify ledger paid/debt/status equals the sum of non-voided payments; overpayment and void behavior must be atomic.
8. `DB-T08` — carry/close twice with the same source period and verify one linked `CARRY_IN`/`CARRY_OUT` pair per enrollment.
9. `DB-T09` — calculate payroll with teacher + assistant and verify each class total is at most `max_total_percent`, with each amount on `rounding_step`.
10. `DB-T10` — attempt client update/delete on `audit_logs`; verify RLS denies it. Verify role changes contain before/after audit data.

Edge negative-case matrix: for every function call with no JWT, wrong role, malformed body, missing UUID/resource and closed-period mutation. Expected status/error codes are defined in `supabase/functions/_shared/error.ts`.
