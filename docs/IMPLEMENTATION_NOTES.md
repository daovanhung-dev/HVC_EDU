# Implementation notes

## Gap closures

- `tuition-summary` implements the SCR-16 contract as a dedicated read Edge Function.
- `void-payment` implements BR-10 without deleting the payment; the ledger is recalculated from active payments and the action is audited.
- `fund_ledger`, `profit_distributions`, `import_jobs`, `import_job_issues` and `idempotency_requests` close the supporting-schema gaps in the plan.
- Financial/session/attendance/evaluation/payroll/close mutations use PostgreSQL RPCs so multi-step writes are atomic and auditable.
- `calculate-payroll` is server-side and validates the policy, staff type, assignment, cap and rounding before `rpc_save_payroll_run` persists the draft.
- Class creation and student + enrollment creation use transactional RPCs so a failed second write cannot leave an orphaned master record.
- Class, student and staff edit/deactivate flows use audited admin-only RPCs; deactivating a student closes active enrollments with history preserved.
- Tuition preview, debt adjustments/carry-over, payment void and data-integrity checks are wired to their screens.
- Role changes use `update-profile-role` → `rpc_update_profile_role` and include before/after audit data.
- Fixbug package: class edits validate grade/fee and duplicate code with full before/after audit; historical tuition ledgers remain unchanged.
- Enrollment status changes use audited `rpc_update_enrollment_status`; `LEFT` requires an end date and is terminal. Re-entry uses audited `rpc_create_enrollment` and a new row.
- Payroll UI is read-only and hydrates staff/class names from `payroll_items`; money is shown only to Admin/Accountant, while teaching roles retain assignment names without amounts.
- Staff accounts use `staff.email`, a center-scoped unique lower-case index, Admin-only `invite-staff-account`, rollback of a newly invited Auth user on link failure, and one-way profile locking when staff becomes inactive.
- Direct browser writes for classes, students, staff and enrollments are revoked; their current create/update flows use audited RPCs, preventing bypass of validation, history retention and terminal `LEFT` enrollment rules.

## Known environment limitation

The current runner has the Supabase CLI and Deno but no Docker/Podman, so migrations cannot be reset/linted locally and generated Supabase types cannot be refreshed from a live schema. The checked-in `database.types.ts` is therefore a minimal compile-time contract, not a generated snapshot.

## Known source-data limitation

The supplied operational workbook is validated server-side, stored in the private import bucket, and imported through the normalized workbook RPC. It maps classes/schedules, staff/assignments, students/enrollments, sessions, C/N attendance, comments as evaluations, tuition snapshots/payments, carry-over/opening-debt adjustments, expenses, payroll, fund ledger and profit distributions. Formula/report/instruction sheets remain preserved in the private source file and reconciliation summary rather than being duplicated into business tables. `#REF!` cells are recorded as warnings and ignored per the import decision; they are never converted to zero. The August 2026 source still has two L09 roster students without accounting rows, 153 blank attendance cells, and two expense rows with missing date/category/description; these are retained as explicit warnings and are not fabricated.

## Decisions

- Money stays integer VND (`bigint` in PostgreSQL); ratios/policies use `numeric`.
- Overpayment is blocked with `PAYMENT_EXCEEDS_DEBT`.
- Closing carries outstanding debt to the next open period, when one exists, using linked `CARRY_IN`/`CARRY_OUT` adjustments and unique source keys.
- Confirmed/paid ledgers and approved payroll are not overwritten by recalculation.
- No service-role or secret key is referenced by Angular.

## Class deletion

- Class deletion is Admin-only through audited `rpc_delete_class`; direct Data API deletes remain unavailable.
- An empty class may be physically deleted with its weekly schedules; a class referenced by enrollment, sessions, assignments, rewards, finance, payroll or period snapshots is deactivated instead so history remains intact.
- Deactivation disables active schedules and non-closed period class configurations, and session generation rejects inactive classes.

## Rebuild workflow notes (2026-09-06)

- The new Angular route tree is hub-first. Existing detail components remain available behind hub tabs or compatibility paths so class, student, finance, audit and import operations are not discarded during the transition.
- `rpc_create_month_setup` is the only final write for the wizard. It generates sessions in the same transaction as the new period and rolls back the whole setup if any class, roster, schedule or assignment validation fails.
- Existing periods receive `LEGACY_ASSIGNMENT` in `period_settings`; wizard-created periods receive `APPROVED_WORK_ATTENDANCE`. No historical check-in rows are fabricated.
- Work attendance is per `class_sessions` row and `staff_id`. Direct browser insert/update is not granted; submit/review/availability/notification writes use security-definer RPCs through Edge Functions.
- Notification reads are recipient-only. Admin fan-out is performed by RPC; automatic admin alerts cover submitted work, payroll pending approval, close blockers and import errors.
- Remote deployment is intentionally separate from this code change. Apply the additive migration and deploy the new functions before releasing the Angular bundle.
