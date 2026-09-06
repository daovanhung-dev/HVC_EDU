# Implementation progress

Kế hoạch nguồn: `docs/tasks/PLAN_GPT_LUNA_FULL_SYSTEM.md`.
Business source of truth: `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md`.

## STEP 01–10 — Foundation, schema, RLS, RPC, Edge framework

Status: DONE (static/type-check evidence)

Implemented:

- Removed frontend `.env`/`environment.ts` runtime path; browser only reads `supabase.constants.ts`.
- Added application constants, Supabase response/error/validation/auth/RPC helpers.
- Added 24 BD tables plus import/idempotency support tables, indexes, updated-at triggers, private import bucket and tenant/assignment-aware RLS.
- Added atomic RPCs for sessions, attendance, evaluations, tuition, payments/voids, adjustments, carry-over, payroll, period close, settings, finance, rewards and profile permissions.
- Added standard success/error envelopes with `traceId`; mutation functions support `x-idempotency-key`.

Files: `supabase/migrations/202609040001_initial_schema.sql` through `202609040006_seed_reference.sql`, `supabase/functions/_shared/*`.

Tests: `deno check --no-config --node-modules-dir=auto supabase/functions/_shared/*.ts supabase/functions/*/index.ts` PASS.

## STEP 11 — Supabase local validation and remote runtime

Status: LOCAL BLOCKED BY ENVIRONMENT; REMOTE APPLIED

`supabase db reset`, local lint and generated type refresh require Docker/Podman. The installed CLI reports that neither Docker nor Podman is available in this environment. The configured remote project has migrations through `202609040011` applied and the import function deployed; the remote workbook import and integrity smoke checks completed.

## STEP 12–30 — Auth, shell, period, education, finance, payroll, reports, settings, audit, migration

Status: IMPLEMENTED; runtime acceptance requires a configured Supabase project.

Implemented:

- 29 requested routes with standalone lazy components, auth/guest/role guards and role-aware navigation.
- Real Data API reads and Edge Function/RPC writes for class, schedule/session, student/enrollment, attendance, evaluation, tuition, payment, debt, finance, payroll, fund/profit, reports, period, settings, audit and migration flows.
- Period context selector, responsive UI primitives, loading/error/empty states, toast and confirmation prompts.
- Server payroll calculation uses configurable policy, integer VND, cap and floor-to-step rounding; Angular does not calculate payroll.
- Tuition preview returns per-enrollment calculations and warnings; generate protects confirmed/paid ledgers.
- Import upload/validation is server-side, stores source privately, records issues and rejects `#REF!`.

## STEP 31 — Unit tests

Status: DONE (available scope)

Tests cover money formatting/parsing, date helpers and API error mapping: 3 files, 4 tests passing.

## STEP 32 — Integration/business tests

Status: READY, not executable without local Supabase

Critical paths are represented by transactional RPCs and the matrix in `docs/BD_TRACEABILITY_MATRIX.md`. Execute the SQL/RLS smoke suite after Docker or a configured project is available.

## STEP 33–35 — Build and GitHub Pages readiness

Status: DONE for local build gates

- `npm ci` PASS.
- `npm test` PASS.
- `npm run build` PASS.
- Pages build with repository base href passed locally; the workflow will repeat the same gate in CI.
- `404.html` fallback is produced by the Pages workflow.

## STEP 36 — Supabase deployment readiness

Status: REMOTE DEPLOYED; CI deployment remains available

The workflow uses GitHub Secrets for access token/database password and a repository variable for project ref. The configured remote project is deployed from this workspace; frontend constants contain the public project URL/publishable key only.

## STEP 37 — BD reconciliation

Status: DONE WITH SOURCE WARNINGS

The source workbook `docs/excels/TrungTam_HungCuong_T8 (1).xlsx` was imported into the remote center for August 2026. Reconciled totals are: tuition due/paid 14,485,000 VND, payroll 5,794,000 VND, other expenses 6,270,898 VND, fund contribution 242,010 VND and distributable profit 2,178,092 VND. Runtime warnings preserve the source discrepancies: two L09 roster students have no accounting rows, 153 attendance cells are blank, two expense rows use explicit fallback metadata, and nine `#REF!` cells are ignored.

## STEP 38 — Fixbug implementation

Status: IMPLEMENTED; remote migrations and invite function deployed

- Class detail now edits class master fields with integer-VND/grade validation, duplicate-code handling and inactive status preservation.
- Student/class roster and student history can end an active enrollment with a required end date; ended enrollments cannot be reopened, and the student detail can create a new enrollment for re-entry.
- Payroll shows staff/class names and read-only revenue, rate, base, bonus, penalty and final amount breakdown. Amounts remain restricted to Admin/Accountant.
- Staff list/detail show email/account state and expose the invite action only to Admin. `invite-staff-account` links the invited Auth user through an audited RPC and removes the new Auth user if linking fails.
- Remote: migrations `202609040012_staff_accounts_enrollment.sql` through `202609040016_enrollment_reentry_guard.sql` applied; `invite-staff-account` deployed.
- Verification: Angular tests 3 files/4 tests PASS; Angular production build PASS; Deno function check PASS; Supabase migration dry-run and remote apply PASS. A real invite delivery test remains intentionally unsent until an approved test recipient is provided.

## STEP 39 — Rebuild workflow tối giản HVC_EDU

Status: IMPLEMENTED IN WORKTREE; DATABASE RUNTIME/REMOTE DEPLOY PENDING

Implemented in the additive migration `supabase/migrations/202609060001_rebuild_workflows.sql`:

- `period_class_configs` and `period_settings` snapshots with legacy payroll backfill.
- Atomic `rpc_create_month_setup` covering period, class snapshot, schedules, sessions, assignments, enrollment actions, settings and linked carry-over.
- `staff_work_attendance` with per-session `CHECK_IN`/`CHECK_OUT`, `SUBMITTED`/`APPROVED`/`REJECTED` review path, audit and notifications.
- `staff_availability` and recipient-scoped `notifications`, manual fan-out and automatic admin alerts.
- New-period tuition/session functions read period snapshots; new-period payroll reads only approved work attendance; close preview/RPC block unresolved work attendance.

Implemented in Angular:

- Role-based hubs for home, month setup, education, teaching, finance, people, notifications, account and settings.
- Nine-step browser draft month wizard and one final `create-month-setup` call.
- Mobile-first teaching cards with check-in/out and links to attendance/evaluation actions.
- Notification inbox, unread badge, read-all and Admin compose form.
- Compatibility redirects for legacy finance, payroll, attendance/evaluation, audit, migration, reports and assignment bookmarks.

Verification in this runner:

- `npm ci`: PASS using temporary Node `22.22.3`.
- `npm test`: PASS, 7 test files / 13 tests.
- `npm run build`: PASS.
- `deno check --no-config --node-modules-dir=auto supabase/functions/_shared/*.ts supabase/functions/*/index.ts`: PASS.
- `supabase db lint` and `supabase db reset`: NOT RUN successfully because local Postgres/Docker runtime is unavailable (`127.0.0.1:54322`, no Docker/Podman). Migration `202609060001_rebuild_workflows.sql` was later applied to the linked remote project.

## STEP 40 — Xóa lớp an toàn

Status: IMPLEMENTED; remote migration applied

- Added Admin-only audited `rpc_delete_class`.
- Empty classes are physically deleted with weekly schedules; classes with operational, financial or period history are deactivated and preserved.
- Deactivation disables active schedules/open period snapshots; inactive classes cannot generate new sessions.
- Added the Admin-only `Xóa lớp` action to class detail with confirmation, loading state and navigation back to the class list.
- Remote migrations `202609060001_rebuild_workflows.sql` and `202609060002_class_deletion.sql` are applied.

Verification:

- `supabase db push --dry-run`: PASS.
- `supabase db push`: PASS.
- Remote migration list: `202609060001` and `202609060002` present.
- Admin JWT smoke call to `rpc_delete_class` with an unknown UUID returned the expected `CLASS_NOT_FOUND` without changing data.
- Angular `npm test` / `npm run build`: NOT RUN in this runner because `node`, `npm` and `npx` are unavailable.
