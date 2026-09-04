# BD traceability matrix

Status values describe repository evidence. `IMPLEMENTED` means code and static/build evidence exists; database/runtime rows still need the Supabase smoke suite when Docker or a remote project is available. `PARTIAL` is used only where the source workbook or a live database is required.

| BD ID | Type | Description | Implementation files | Test | Status |
|---|---|---|---|---|---|
| ACT-01 | Actor | Admin/owner | `auth.models.ts`, `role.guard.ts`, RLS | build; Deno check | IMPLEMENTED |
| ACT-02 | Actor | Accountant | `auth.models.ts`, finance routes, RLS | build; Deno check | IMPLEMENTED |
| ACT-03 | Actor | Teacher | attendance/evaluation routes, assignment RLS | build; Deno check | IMPLEMENTED |
| ACT-04 | Actor | Teaching assistant | attendance/evaluation routes, assignment RLS | build; Deno check | IMPLEMENTED |
| DQ-01 | Data quality | Roster 50 vs ledger 48 | `data-integrity-check`, migration docs | runtime DB smoke pending | IMPLEMENTED |
| DQ-02 | Data quality | Reject `#REF!` carry-over | `import-center-workbook` | Deno check | IMPLEMENTED |
| DQ-03 | Data quality | Required finance metadata | `record-financial-transaction`, integrity check | Deno check | IMPLEMENTED |
| DQ-04 | Data quality | Payroll policy/default mismatch | `calculate-payroll`, `payroll_policies` seed | Deno check | IMPLEMENTED |
| DQ-05 | Data quality | Excel date/session parsing | import validator, integer schema checks | runtime workbook pending | PARTIAL |
| TBL-01 | Table | centers | `202609040001_initial_schema.sql` | DB reset pending | IMPLEMENTED |
| TBL-02 | Table | profiles | `202609040001_initial_schema.sql`, role RPC | DB reset pending | IMPLEMENTED |
| TBL-03 | Table | accounting_periods | initial schema, period RPC | DB reset pending | IMPLEMENTED |
| TBL-04 | Table | classes | initial schema, class RPC | DB reset pending | IMPLEMENTED |
| TBL-05 | Table | class_schedules | initial schema, class RPC | DB reset pending | IMPLEMENTED |
| TBL-06 | Table | students | initial schema, student RPC | DB reset pending | IMPLEMENTED |
| TBL-07 | Table | enrollments | initial schema, student RPC, RLS | DB reset pending | IMPLEMENTED |
| TBL-08 | Table | class_sessions | initial schema, session RPC | DB reset pending | IMPLEMENTED |
| TBL-09 | Table | attendance | initial schema, bulk attendance RPC | DB reset pending | IMPLEMENTED |
| TBL-10 | Table | student_session_evaluations | initial schema, bulk evaluation RPC | DB reset pending | IMPLEMENTED |
| TBL-11 | Table | staff | initial schema, seed | DB reset pending | IMPLEMENTED |
| TBL-12 | Table | class_assignments | initial schema, assignment RPC | DB reset pending | IMPLEMENTED |
| TBL-13 | Table | tuition_ledgers | initial schema, tuition RPC | DB reset pending | IMPLEMENTED |
| TBL-14 | Table | tuition_adjustments | initial schema, adjustment/carry RPC | DB reset pending | IMPLEMENTED |
| TBL-15 | Table | payments | initial schema, payment/void RPC | DB reset pending | IMPLEMENTED |
| TBL-16 | Table | student_rewards | initial schema, reward RPC | DB reset pending | IMPLEMENTED |
| TBL-17 | Table | financial_transactions | initial schema, finance RPC | DB reset pending | IMPLEMENTED |
| TBL-18 | Table | payroll_policies | initial schema, seed/policy selection | DB reset pending | IMPLEMENTED |
| TBL-19 | Table | payroll_runs | initial schema, payroll RPC | DB reset pending | IMPLEMENTED |
| TBL-20 | Table | payroll_items | initial schema, payroll RPC | DB reset pending | IMPLEMENTED |
| TBL-21 | Table | fund_ledger | `202609040003_full_system.sql`, close RPC | DB reset pending | IMPLEMENTED |
| TBL-22 | Table | profit_distributions | full schema, distribution RPC | DB reset pending | IMPLEMENTED |
| TBL-23 | Table | system_settings | initial schema, setting RPC | DB reset pending | IMPLEMENTED |
| TBL-24 | Table | audit_logs | initial schema, server RPCs | DB reset pending | IMPLEMENTED |
| BR-01 | Rule | Unique class code per center | classes unique constraint/RLS | DB reset pending | IMPLEMENTED |
| BR-02 | Rule | Unique student code per center | students unique constraint/RLS | DB reset pending | IMPLEMENTED |
| BR-03 | Rule | Enrollment active by date | enrollment schema, tuition/attendance RPC | DB reset pending | IMPLEMENTED |
| BR-04 | Rule | Idempotent session generation | `rpc_generate_month_sessions` | Deno check; DB repeat test pending | IMPLEMENTED |
| BR-05 | Rule | Assigned/admin attendance only | attendance RPC + `has_class_assignment` | DB RLS test pending | IMPLEMENTED |
| BR-06 | Rule | Evaluation fields and scale | evaluation schema/RPC/UI | Deno check | IMPLEMENTED |
| BR-07 | Rule | Override unit price | tuition preview/generate | Deno check | IMPLEMENTED |
| BR-08 | Rule | PER_SESSION formula | tuition preview/generate RPC | DB formula test pending | IMPLEMENTED |
| BR-09 | Rule | PREPAID planned-session formula | tuition preview/generate RPC | DB formula test pending | IMPLEMENTED |
| BR-10 | Rule | Payment, void, debt recalc | payment/void RPC + audit | DB atomicity test pending | IMPLEMENTED |
| BR-11 | Rule | Linked idempotent carry-over | carry RPC + unique index + close RPC | DB repeat test pending | IMPLEMENTED |
| BR-12 | Rule | Configurable payroll/cap/rounding | calculate payroll + save RPC | Deno check; DB cap test pending | IMPLEMENTED |
| BR-13 | Rule | Fund/profit formula | close RPC + fund UI | DB formula test pending | IMPLEMENTED |
| BR-14 | Rule | 100% distribution ratio | distribution UI/RPC + close blocker | DB ratio test pending | IMPLEMENTED |
| BR-15 | Rule | Close blockers | preview/close/integrity functions | Deno check; DB close test pending | IMPLEMENTED |
| BR-16 | Rule | Audit consequential mutations | audit inserts in RPCs | DB audit test pending | IMPLEMENTED |
| UC-01 | Use case | Login | `auth.service.ts`, login, guards | npm test/build | IMPLEMENTED |
| UC-02 | Use case | Manage class | class list/detail/form/schedule | npm build | IMPLEMENTED |
| UC-03 | Use case | Manage student | student list/form/detail/enrollment RPC | npm build | IMPLEMENTED |
| UC-04 | Use case | Manage schedule | schedule screen/session RPC | npm build; Deno check | IMPLEMENTED |
| UC-05 | Use case | Manage staff | staff screens + RLS | npm build | IMPLEMENTED |
| UC-06 | Use case | Manage assignment | assignment screen/RPC | npm build; Deno check | IMPLEMENTED |
| UC-07 | Use case | Attendance | attendance screen/bulk RPC | npm build; Deno check | IMPLEMENTED |
| UC-08 | Use case | Evaluation | evaluation screen/bulk RPC | npm build; Deno check | IMPLEMENTED |
| UC-09 | Use case | Generate tuition | preview/generate screens/functions | npm build; Deno check | IMPLEMENTED |
| UC-10 | Use case | Record payment | payment form/payment RPC | npm build; Deno check | IMPLEMENTED |
| UC-11 | Use case | Debt/carry-over | debts + adjustment/carry RPC | npm build; Deno check | IMPLEMENTED |
| UC-12 | Use case | Other finance | transactions screen/RPC | npm build; Deno check | IMPLEMENTED |
| UC-13 | Use case | Student rewards | rewards screen/RPC | npm build; Deno check | IMPLEMENTED |
| UC-14 | Use case | Payroll | payroll screen/calculate/approve | npm build; Deno check | IMPLEMENTED |
| UC-15 | Use case | Fund/profit | fund screen/close/distribution RPC | npm build; Deno check | IMPLEMENTED |
| UC-16 | Use case | Reports | class/student report screens/views | npm build | IMPLEMENTED |
| UC-17 | Use case | Close period | preview/close RPC | Deno check; DB pending | IMPLEMENTED |
| UC-18 | Use case | Settings | settings/profile role screen/RPC | npm build; Deno check | IMPLEMENTED |
| UC-19 | Use case | Audit | audit screen/RLS | npm build | IMPLEMENTED |
| UC-20 | Use case | Excel import | migration/upload/validation | Deno check; workbook pending | PARTIAL |
| AC-01 | Acceptance flow | Monthly operation | period → sessions → attendance → tuition → payroll → close | manual/runtime pending | IMPLEMENTED |
| AC-02 | Acceptance flow | Attendance/evaluation | roster → C/N/P → evaluation → bulk save | npm build; Deno check | IMPLEMENTED |
| AC-03 | Acceptance flow | Tuition | preview → snapshot → payment/debt | Deno check; DB pending | IMPLEMENTED |
| AC-04 | Acceptance flow | Payroll | policy → cap → round → draft/approve | Deno check; DB pending | IMPLEMENTED |
| AC-05 | Acceptance flow | Carry-over | source → linked target → reconciliation | Deno check; DB pending | IMPLEMENTED |
| SEQ-01 | Sequence | Login/session/profile | AuthService + profile RLS | npm test/build | IMPLEMENTED |
| SEQ-02 | Sequence | Dashboard aggregate | dashboard-summary | Deno check | IMPLEMENTED |
| SEQ-03 | Sequence | Attendance bulk | attendance EF → attendance RPC → audit | Deno check | IMPLEMENTED |
| SEQ-04 | Sequence | Generate tuition | preview/generate → tuition RPC | Deno check | IMPLEMENTED |
| SEQ-05 | Sequence | Payment | payment EF → lock/recalc/audit RPC | Deno check | IMPLEMENTED |
| SEQ-06 | Sequence | Payroll | calculate → save → approve | Deno check | IMPLEMENTED |
| SEQ-07 | Sequence | Close period | preview → revalidate/carry/fund/close | Deno check; DB pending | IMPLEMENTED |
| DA-01 | Data API | Classes | classes reads + class RLS | npm build | IMPLEMENTED |
| DA-02 | Data API | Class schedules | schedules reads + RLS | npm build | IMPLEMENTED |
| DA-03 | Data API | Students | student reads + assignment RLS | npm build | IMPLEMENTED |
| DA-04 | Data API | Enrollments | enrollment reads + center RLS | npm build | IMPLEMENTED |
| DA-05 | Data API | Sessions | session reads + assignment RLS | npm build | IMPLEMENTED |
| DA-06 | Data API | Attendance | attendance reads; writes via EF | npm build | IMPLEMENTED |
| DA-07 | Data API | Evaluations | evaluation reads; writes via EF | npm build | IMPLEMENTED |
| DA-08 | Data API | Staff | staff reads + role scope | npm build | IMPLEMENTED |
| DA-09 | Data API | Assignments | assignment reads + center scope | npm build | IMPLEMENTED |
| DA-10 | Data API | Tuition ledgers | finance reads only | npm build | IMPLEMENTED |
| DA-11 | Data API | Payments | finance reads; writes via EF | npm build | IMPLEMENTED |
| DA-12 | Data API | Other finance | reads; writes via secured RPC | npm build | IMPLEMENTED |
| DA-13 | Data API | Payroll items | finance reads | npm build | IMPLEMENTED |
| DA-14 | Data API | Audit | admin reads, no client mutation | npm build | IMPLEMENTED |
| EF-01 | Edge Function | Dashboard summary | `dashboard-summary` | Deno check | IMPLEMENTED |
| EF-02 | Edge Function | Generate sessions | `generate-month-sessions` | Deno check | IMPLEMENTED |
| EF-03 | Edge Function | Attendance bulk | `attendance-bulk-upsert` | Deno check | IMPLEMENTED |
| EF-04 | Edge Function | Evaluation bulk | `evaluation-bulk-upsert` | Deno check | IMPLEMENTED |
| EF-05 | Edge Function | Tuition preview | `tuition-preview` | Deno check | IMPLEMENTED |
| EF-06 | Edge Function | Generate tuition | `generate-tuition` | Deno check | IMPLEMENTED |
| EF-07 | Edge Function | Record payment | `record-payment` | Deno check | IMPLEMENTED |
| EF-08 | Edge Function | Tuition adjustment | `create-tuition-adjustment` | Deno check | IMPLEMENTED |
| EF-09 | Edge Function | Carry-over | `carry-over-period` | Deno check | IMPLEMENTED |
| EF-10 | Edge Function | Calculate payroll | `calculate-payroll` | Deno check | IMPLEMENTED |
| EF-11 | Edge Function | Approve payroll | `approve-payroll` | Deno check | IMPLEMENTED |
| EF-12 | Edge Function | Close preview | `close-period-preview` | Deno check | IMPLEMENTED |
| EF-13 | Edge Function | Close period | `close-period` | Deno check | IMPLEMENTED |
| EF-14 | Edge Function | Integrity check | `data-integrity-check` | Deno check | IMPLEMENTED |
| EF-15 | Edge Function | Excel import | `import-center-workbook` | Deno check; workbook pending | PARTIAL |
| EF-16 | Edge Function | Tuition summary gap closure | `tuition-summary` | Deno check | IMPLEMENTED |
| EF-17 | Edge Function | Void payment gap closure | `void-payment` | Deno check | IMPLEMENTED |
| SCR-01 | Screen | Login | `/login` | npm build | IMPLEMENTED |
| SCR-02 | Screen | Dashboard | `/dashboard` | npm build | IMPLEMENTED |
| SCR-03 | Screen | Classes list | `/classes` | npm build | IMPLEMENTED |
| SCR-04 | Screen | Create class | `/classes/new` | npm build | IMPLEMENTED |
| SCR-05 | Screen | Class detail | `/classes/:id` | npm build | IMPLEMENTED |
| SCR-06 | Screen | Class schedule | `/classes/:id/schedule` | npm build | IMPLEMENTED |
| SCR-07 | Screen | Students list | `/students` | npm build | IMPLEMENTED |
| SCR-08 | Screen | Add student | `/students/new` | npm build | IMPLEMENTED |
| SCR-09 | Screen | Student detail | `/students/:id` | npm build | IMPLEMENTED |
| SCR-10 | Screen | Attendance selector | `/attendance` | npm build | IMPLEMENTED |
| SCR-11 | Screen | Attendance session | `/attendance/:sessionId` | npm build | IMPLEMENTED |
| SCR-12 | Screen | Evaluation session | `/evaluations/:sessionId` | npm build | IMPLEMENTED |
| SCR-13 | Screen | Staff list | `/staff` | npm build | IMPLEMENTED |
| SCR-14 | Screen | Staff detail | `/staff/:id` | npm build | IMPLEMENTED |
| SCR-15 | Screen | Assignments | `/assignments` | npm build | IMPLEMENTED |
| SCR-16 | Screen | Tuition summary | `/finance/tuition` | npm build | IMPLEMENTED |
| SCR-17 | Screen | Class tuition | `/finance/tuition/:classId` | npm build | IMPLEMENTED |
| SCR-18 | Screen | Payment form | `/finance/payments/new` | npm build | IMPLEMENTED |
| SCR-19 | Screen | Debts | `/finance/debts` | npm build | IMPLEMENTED |
| SCR-20 | Screen | Other finance | `/finance/transactions` | npm build | IMPLEMENTED |
| SCR-21 | Screen | Rewards | `/finance/rewards` | npm build | IMPLEMENTED |
| SCR-22 | Screen | Payroll | `/payroll` | npm build | IMPLEMENTED |
| SCR-23 | Screen | Fund/profit | `/finance/fund-profit` | npm build | IMPLEMENTED |
| SCR-24 | Screen | Class reports | `/reports/classes` | npm build | IMPLEMENTED |
| SCR-25 | Screen | Student reports | `/reports/students` | npm build | IMPLEMENTED |
| SCR-26 | Screen | Periods | `/periods` | npm build | IMPLEMENTED |
| SCR-27 | Screen | Settings | `/settings` | npm build | IMPLEMENTED |
| SCR-28 | Screen | Audit | `/audit` | npm build | IMPLEMENTED |
| SCR-29 | Screen | Migration | `/migration` | npm build | IMPLEMENTED |
