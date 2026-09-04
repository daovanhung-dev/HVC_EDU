# Agent instructions

Project execution plan: `docs/tasks/PLAN_GPT_LUNA_FULL_SYSTEM.md`.

Read `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md` before implementing business features.

## Architecture rules
- FE: Angular standalone components.
- BE: Supabase PostgreSQL/Data API + Edge Functions.
- Direct browser writes are allowed only for simple master data covered by RLS.
- Financial and month-closing mutations must go through Edge Functions or transactional DB RPC.
- Never expose Supabase secret/service keys in Angular.
- Preserve tenant isolation via `center_id` and RLS.
- Money is integer VND (`bigint` in Postgres); never floating point.
- Keep historical entities; prefer status/void over physical deletes for financial records.
- Add audit for consequential mutations.
- Frontend Supabase configuration belongs in `src/app/core/config/supabase.constants.ts`; do not use `.env` or `environment.ts` at runtime.
- Quality gates are `npm ci`, `npm test`, `npm run build`, and Supabase migration/function checks when Docker/credentials are available.

## Naming
- DB: snake_case, plural tables.
- Angular routes/features: kebab-case.
- Edge Functions: kebab-case.
