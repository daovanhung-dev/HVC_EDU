# Agent instructions

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

## Naming
- DB: snake_case, plural tables.
- Angular routes/features: kebab-case.
- Edge Functions: kebab-case.
