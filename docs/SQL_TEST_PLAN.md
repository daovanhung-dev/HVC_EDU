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
11. `DB-T11` — call `rpc_create_month_setup` with an invalid assignment after valid period/snapshot/schedule payload; verify no period, snapshot, session, enrollment or assignment remains. Repeat a successful call with the same idempotency key and verify no duplicate month.
12. `DB-T12` — verify backfilled periods use `LEGACY_ASSIGNMENT`, wizard periods use `APPROVED_WORK_ATTENDANCE`, and tuition/session generation reads `period_class_configs` instead of mutable class master values.
13. `DB-T13` — verify only an assigned teacher/assistant can check in/out; checkout before check-in fails; checkout creates `SUBMITTED`; Admin approve/reject requires the expected state and rejection reason.
14. `DB-T14` — verify payroll for an `APPROVED_WORK_ATTENDANCE` period counts only `APPROVED` work rows, while a legacy period still uses the legacy assignment basis. Verify closed periods reject work attendance mutations.
15. `DB-T15` — verify staff availability is center-scoped and a teacher can write only their own availability. Verify cross-center and non-recipient notification reads are denied.
16. `DB-T16` — verify Admin manual notification fan-out to ALL/ROLE/USER creates one row per recipient, dedupes by key, and only the recipient can mark/read it.
17. `DB-T17` — verify payroll pending, close blocker and import error events create recipient-scoped Admin inbox notifications with audit records.

Edge negative-case matrix: for every function call with no JWT, wrong role, malformed body, missing UUID/resource and closed-period mutation. Expected status/error codes are defined in `supabase/functions/_shared/error.ts`.
