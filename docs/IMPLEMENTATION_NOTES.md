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

## Known environment limitation

The current runner has the Supabase CLI and Deno but no Docker/Podman, so migrations cannot be reset/linted locally and generated Supabase types cannot be refreshed from a live schema. The checked-in `database.types.ts` is therefore a minimal compile-time contract, not a generated snapshot.

## Known source-data limitation

The project does not contain the operational workbook. The migration function validates the uploaded workbook server-side, stores it in a private bucket, records sheet samples/issues and blocks `#REF!`; source-specific normalization/reconciliation must be verified against the real workbook before production import. It deliberately does not convert formula errors to zero.

## Decisions

- Money stays integer VND (`bigint` in PostgreSQL); ratios/policies use `numeric`.
- Overpayment is blocked with `PAYMENT_EXCEEDS_DEBT`.
- Closing carries outstanding debt to the next open period, when one exists, using linked `CARRY_IN`/`CARRY_OUT` adjustments and unique source keys.
- Confirmed/paid ledgers and approved payroll are not overwritten by recalculation.
- No service-role or secret key is referenced by Angular.
