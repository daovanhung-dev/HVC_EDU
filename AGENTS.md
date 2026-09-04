# Agent instructions

## Mandatory context loading

Before implementing or modifying non-trivial behavior, start at:

`docs/agent-context/README.md`

Then load the relevant context files in that directory before reading implementation details.

Primary business source of truth:

`docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md`

Project execution plan:

`docs/tasks/PLAN_GPT_LUNA_FULL_SYSTEM.md`

Traceability and current implementation evidence:

- `docs/BD_TRACEABILITY_MATRIX.md`
- `docs/IMPLEMENTATION_PROGRESS.md`
- `docs/IMPLEMENTATION_NOTES.md`

## Architecture rules

- FE: Angular standalone components.
- BE: Supabase PostgreSQL/Data API + Edge Functions.
- Direct browser writes are allowed only for simple data when current grants/RLS explicitly allow them.
- Financial, payroll, period-close, import, role/account and other consequential mutations must use the established Edge Function/RPC transactional path.
- Never expose Supabase secret/service keys, DB passwords or CI access tokens in Angular.
- Preserve tenant isolation via `center_id`, role and assignment-aware RLS.
- Money is integer VND (`bigint` in Postgres); never floating point.
- Keep historical entities; prefer status/void/new-history-row over physical deletes for financial/history records.
- `LEFT` enrollment history is terminal; re-entry creates a new enrollment row.
- Add/retain audit for consequential mutations.
- Respect idempotency for retry-prone financial/period/import operations.
- Frontend Supabase configuration belongs in `src/app/core/config/supabase.constants.ts`; do not use `.env` or `environment.ts` at runtime for browser Supabase config.
- Do not move authoritative payroll/tuition/close-period calculation into Angular.

## Change workflow

For a task, trace:

`route/component → service → Data API/Edge Function → RPC → tables/RLS → tests`.

Read migrations before changing assumptions about schema, permissions or server-side business rules.

Prefer a new migration over rewriting already-applied migration history.

## Quality gates

Minimum checks:

```bash
npm ci
npm test
npm run build
```

Edge Function checks when Deno is available:

```bash
deno check --no-config --node-modules-dir=auto supabase/functions/_shared/*.ts supabase/functions/*/index.ts
```

When Docker/Podman and Supabase local are available, also validate migrations/RLS/business SQL paths.

Do not claim full completion if required runtime, remote, credential or deployment verification has not been executed.

## Naming

- DB: snake_case, plural tables.
- Angular routes/features: kebab-case.
- Edge Functions: kebab-case.
