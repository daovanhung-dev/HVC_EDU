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

## STEP 11 — Supabase local validation

Status: BLOCKED BY ENVIRONMENT

`supabase db reset`, local lint and generated type refresh require Docker/Podman. The installed CLI reports that neither Docker nor Podman is available in this environment. No remote project URL/key/password was supplied, so no remote migration or function deploy was attempted.

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

Status: READY, deployment not performed

The workflow uses GitHub Secrets for access token/database password and a repository variable for project ref. Frontend constants contain placeholders until the owner supplies the public project URL/key.

## STEP 37 — BD reconciliation

Status: PARTIAL / AWAITING SOURCE WORKBOOK

Reference seed covers the four classes, five staff records, August/September 2026 periods and 25/15/40% payroll policy. No `.xlsx`/`.xls` source file exists in the workspace, so the 50-vs-48 roster/ledger and August financial totals cannot be reconciled without inventing data. The migration validator is prepared to report those source-specific issues once the workbook is supplied.
