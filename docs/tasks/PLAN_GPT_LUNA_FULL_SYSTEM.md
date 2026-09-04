# MASTER IMPLEMENTATION PLAN — HỆ THỐNG QUẢN LÝ TRUNG TÂM HÙNG CƯỜNG

> **Tệp dành cho:** GPT Luna / AI Coding Agent  
> **Mục tiêu:** Xây dựng và build hoàn chỉnh 100% hệ thống theo `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md`  
> **Phiên bản plan:** 1.0  
> **Ngày:** 04/09/2026  
> **Frontend:** Angular 22.x, standalone components  
> **Backend:** Supabase PostgreSQL + Auth + Data API + Storage + Edge Functions  
> **Deploy FE:** GitHub Pages  
> **Deploy BE:** Supabase Cloud  
> **Yêu cầu cấu hình đặc biệt:** **KHÔNG dùng `.env`, KHÔNG dùng `environment.ts` để chứa Supabase URL/key. Dùng file constant TypeScript.**

---

# 0. CHỈ THỊ BẮT BUỘC CHO GPT LUNA

## 0.1 Mục tiêu thực thi

GPT Luna phải coi tài liệu này là **execution plan**, không phải tài liệu tham khảo.

Phải thực hiện lần lượt:

1. Đọc toàn bộ:
   - `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md`
   - `PLAN_GPT_LUNA_FULL_SYSTEM.md`
   - `AGENTS.md`
   - `README.md`
2. Rà soát project init hiện tại.
3. Sửa foundation theo plan.
4. Hoàn thiện database.
5. Hoàn thiện RLS.
6. Hoàn thiện Edge Functions.
7. Hoàn thiện toàn bộ 29 màn hình.
8. Hoàn thiện toàn bộ nghiệp vụ.
9. Viết test.
10. Chạy migration.
11. Chạy lint/typecheck/test/build.
12. Fix cho đến khi build pass.
13. Deploy-ready GitHub Pages + Supabase.
14. Tạo báo cáo cuối cùng đối chiếu 100% với BD.

**Không được dừng ở mock UI.**  
**Không được để TODO cho chức năng bắt buộc trong BD.**  
**Không được đánh dấu hoàn thành nếu chỉ có giao diện nhưng chưa có database/API thật.**

---

## 0.2 Source of truth

Thứ tự ưu tiên khi có mâu thuẫn:

1. `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md`
2. Tài liệu plan này.
3. Schema/migration đã triển khai và được test.
4. Code init hiện tại.

Nếu code init khác BD → sửa code theo BD.

Nếu BD thiếu chi tiết kỹ thuật nhưng nghiệp vụ rõ → bổ sung implementation tối thiểu cần thiết, không thay đổi nghiệp vụ.

---

## 0.3 Quy tắc không hỏi lại

Trong quá trình thực hiện:

- Không hỏi user những chi tiết có thể suy ra từ BD.
- Không dừng để xin confirm giữa các phase.
- Nếu gặp thiếu field kỹ thuật, chọn phương án tối giản, rõ ràng, backward-compatible.
- Nếu phát hiện bug/contradiction, ghi lại trong `docs/IMPLEMENTATION_NOTES.md`, sửa theo hướng bảo toàn nghiệp vụ.
- Chỉ dừng khi có blocker thực sự như thiếu Supabase project URL/key thật hoặc không có quyền deploy.

---

# 1. DEFINITION OF DONE — 100% HOÀN THÀNH

Hệ thống chỉ được coi là hoàn thành khi đạt **tất cả**:

## 1.1 Database

- [ ] Có migration cho toàn bộ entity trong BD.
- [ ] Có FK, unique constraint, check constraint cần thiết.
- [ ] Tiền dùng `bigint`, không float.
- [ ] Có indexes cho các truy vấn chính.
- [ ] Có RLS trên mọi bảng exposed qua Data API.
- [ ] Có helper functions phục vụ RLS.
- [ ] Có trigger `updated_at` khi phù hợp.
- [ ] Có audit cho mutation quan trọng.
- [ ] Có seed dữ liệu demo hoặc migration dữ liệu thật tháng 08/2026.
- [ ] `supabase db reset` chạy thành công.

## 1.2 Backend

- [ ] Toàn bộ Edge Functions trong BD được implement.
- [ ] Các business transaction dùng RPC/transaction an toàn.
- [ ] Có auth/role validation server-side.
- [ ] Có response format chuẩn.
- [ ] Có `traceId`.
- [ ] Có idempotency cho nghiệp vụ bắt buộc.
- [ ] Có validation request.
- [ ] Có CORS.
- [ ] Không expose secret.
- [ ] Có test bằng curl/Deno/SQL cho nghiệp vụ trọng yếu.

## 1.3 Frontend

- [ ] 29/29 màn hình BD có route thật.
- [ ] Màn hình dùng API/database thật, không mock.
- [ ] Có loading/error/empty state.
- [ ] Có role guard/navigation theo quyền.
- [ ] Có form validation.
- [ ] Có responsive desktop/tablet/mobile cơ bản.
- [ ] Có toast/dialog confirm.
- [ ] Có pagination/filter/search cho danh sách lớn.
- [ ] Có xử lý deep-link GitHub Pages.

## 1.4 Nghiệp vụ

- [ ] Class.
- [ ] Schedule.
- [ ] Student.
- [ ] Enrollment.
- [ ] Session.
- [ ] Attendance.
- [ ] Evaluation.
- [ ] Staff.
- [ ] Assignment.
- [ ] Tuition.
- [ ] Payment.
- [ ] Debt.
- [ ] Adjustment.
- [ ] Carry-over.
- [ ] Transaction.
- [ ] Reward.
- [ ] Payroll.
- [ ] Fund.
- [ ] Profit distribution.
- [ ] Period open/close.
- [ ] Dashboard.
- [ ] Reports.
- [ ] Audit.
- [ ] Excel migration.
- [ ] Integrity check.

## 1.5 Quality gates

Phải pass:

```bash
npm ci
npm run build
npm test
npx supabase db reset
npx supabase functions serve
```

Nếu project có lint script:

```bash
npm run lint
```

Ngoài ra:

- [ ] Không có TypeScript compile error.
- [ ] Không có SQL migration error.
- [ ] Không có route dead-end.
- [ ] Không có nút chính không hoạt động.
- [ ] Không còn mock data trong production flow.
- [ ] Không còn `TODO` thuộc scope BD.
- [ ] Không còn `console.log` debug nhạy cảm.
- [ ] Không commit secret/service key.

---

# 2. QUY TẮC CONFIG SUPABASE — KHÔNG DÙNG ENV

## 2.1 Bắt buộc xóa cơ chế env hiện tại

Project init hiện có cơ chế generate environment. Phải loại bỏ:

```text
.env
.env.example
scripts/generate-env.mjs
src/environments/
```

Nếu `.gitignore` có rule chỉ phục vụ `.env` có thể giữ để phòng ngừa, nhưng code **không được phụ thuộc `.env`**.

Sửa `package.json`:

### Trước
```json
"start": "node scripts/generate-env.mjs && ng serve",
"build": "node scripts/generate-env.mjs && ng build"
```

### Sau
```json
"start": "ng serve",
"build": "ng build",
"build:pages": "ng build --configuration production"
```

---

## 2.2 Tạo constant

Tạo:

```text
src/app/core/config/supabase.constants.ts
```

Nội dung:

```ts
export const SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY',
} as const;
```

Có thể tạo thêm:

```text
src/app/core/config/app.constants.ts
```

```ts
export const APP_CONFIG = {
  appName: 'Hùng Cường Center Management',
  centerCode: 'HC',
  locale: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  currency: 'VND',
} as const;
```

### Cực kỳ quan trọng

Được phép đặt trong FE constant:

- Supabase project URL.
- Supabase publishable key / legacy anon public key nếu project chưa chuyển key mới.

**Không bao giờ đặt trong Angular:**

- `service_role`.
- Supabase secret key.
- DB password.
- Supabase access token.
- OpenAI/Gemini secret.
- GitHub token.

Các secret dùng cho CI/CD phải đặt trong **GitHub Secrets**, đây không phải `.env`.

---

## 2.3 Sửa SupabaseService

`src/app/core/supabase/supabase.service.ts`:

```ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase.constants';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
```

Không import `environment`.

---

## 2.4 GitHub Pages workflow

FE không cần inject Supabase variables nữa.

Xóa step kiểu:

```yaml
env:
  SUPABASE_URL: ...
  SUPABASE_PUBLISHABLE_KEY: ...
```

Build trực tiếp source constant:

```bash
npm ci
npm run build:pages -- --base-href "/${REPO_NAME}/"
```

Supabase deployment vẫn dùng:

- `SUPABASE_ACCESS_TOKEN`: GitHub Secret.
- `SUPABASE_DB_PASSWORD`: GitHub Secret.
- `SUPABASE_PROJECT_REF`: GitHub Variable/constant CI.

Không lưu các giá trị secret đó trong source.

---

# 3. KIẾN TRÚC CHỐT

```text
Browser
  │
  ▼
Angular SPA
  │
  ├── Supabase Auth
  │
  ├── Supabase Data API
  │       └── PostgreSQL + RLS
  │
  └── Supabase Edge Functions
          ├── Validate JWT/Role
          ├── Business rules
          ├── Transaction/RPC
          ├── Audit
          └── PostgreSQL
```

## 3.1 Quy tắc FE → Data API

Cho phép trực tiếp khi:

- SELECT.
- CRUD master data đơn giản.
- Không có nhiều side effect.
- RLS đủ để bảo vệ.

Ví dụ:
- classes.
- class_schedules.
- students.
- enrollments.
- staff.
- class_assignments.

## 3.2 Quy tắc FE → Edge Function

Bắt buộc:

- generate sessions.
- bulk attendance.
- bulk evaluation nếu muốn audit đồng nhất.
- tuition preview/generate.
- payment.
- adjustments.
- carry-over.
- payroll.
- close period.
- integrity check.
- import Excel.
- finance mutation quan trọng.
- role/security mutation.

---

# 4. CẤU TRÚC SOURCE CUỐI CÙNG

Luna phải đưa project về dạng tối thiểu sau:

```text
src/
├── app/
│   ├── core/
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.guard.ts
│   │   │   ├── role.guard.ts
│   │   │   └── auth.models.ts
│   │   ├── config/
│   │   │   ├── app.constants.ts
│   │   │   └── supabase.constants.ts
│   │   ├── supabase/
│   │   │   ├── supabase.service.ts
│   │   │   └── database.types.ts
│   │   ├── api/
│   │   │   ├── edge-function.service.ts
│   │   │   ├── api-response.model.ts
│   │   │   └── api-error.ts
│   │   ├── guards/
│   │   ├── services/
│   │   │   ├── toast.service.ts
│   │   │   ├── confirm.service.ts
│   │   │   └── period-context.service.ts
│   │   └── utils/
│   │       ├── money.util.ts
│   │       ├── date.util.ts
│   │       └── validation.util.ts
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── page-header/
│   │   │   ├── data-table/
│   │   │   ├── empty-state/
│   │   │   ├── loading/
│   │   │   ├── confirm-dialog/
│   │   │   ├── status-badge/
│   │   │   ├── period-selector/
│   │   │   └── money-display/
│   │   ├── directives/
│   │   └── pipes/
│   │
│   ├── layout/
│   │   ├── app-shell.component.*
│   │   ├── sidebar.component.*
│   │   └── topbar.component.*
│   │
│   └── features/
│       ├── auth/
│       ├── dashboard/
│       ├── classes/
│       ├── students/
│       ├── attendance/
│       ├── evaluations/
│       ├── staff/
│       ├── assignments/
│       ├── tuition/
│       ├── finance/
│       ├── payroll/
│       ├── reports/
│       ├── periods/
│       ├── settings/
│       ├── audit/
│       └── migration/
│
├── styles/
└── main.ts

supabase/
├── migrations/
├── seed.sql
├── tests/
└── functions/
    ├── _shared/
    │   ├── auth.ts
    │   ├── cors.ts
    │   ├── response.ts
    │   ├── error.ts
    │   ├── trace.ts
    │   ├── validation.ts
    │   └── roles.ts
    ├── dashboard-summary/
    ├── tuition-summary/
    ├── generate-month-sessions/
    ├── attendance-bulk-upsert/
    ├── evaluation-bulk-upsert/
    ├── tuition-preview/
    ├── generate-tuition/
    ├── record-payment/
    ├── create-tuition-adjustment/
    ├── carry-over-period/
    ├── calculate-payroll/
    ├── approve-payroll/
    ├── close-period-preview/
    ├── close-period/
    ├── data-integrity-check/
    └── import-center-workbook/
```

---

# 5. DATA MODEL — PHẢI TRIỂN KHAI ĐỦ

## 5.1 Core tables theo BD

Phải có ít nhất 24 bảng business:

1. `centers`
2. `profiles`
3. `accounting_periods`
4. `classes`
5. `class_schedules`
6. `students`
7. `enrollments`
8. `class_sessions`
9. `attendance`
10. `student_session_evaluations`
11. `staff`
12. `class_assignments`
13. `tuition_ledgers`
14. `tuition_adjustments`
15. `payments`
16. `student_rewards`
17. `financial_transactions`
18. `payroll_policies`
19. `payroll_runs`
20. `payroll_items`
21. `fund_ledger`
22. `profit_distributions`
23. `system_settings`
24. `audit_logs`

## 5.2 Supporting tables cần bổ sung để đóng gap kỹ thuật BD

### `import_jobs`

Vì EF `import-center-workbook` nhận `import_job_id`.

Fields tối thiểu:

```text
id uuid PK
center_id uuid
file_name text
storage_path text
status enum/string
mode string
summary jsonb
created_by uuid
created_at timestamptz
started_at timestamptz
completed_at timestamptz
error_message text
```

Status:
- UPLOADED
- VALIDATING
- READY
- IMPORTING
- COMPLETED
- FAILED

### `import_job_issues`

```text
id uuid
import_job_id uuid
severity ERROR/WARNING
sheet_name text
row_number int nullable
code text
message text
raw_data jsonb
resolved boolean
```

### `idempotency_requests` hoặc business unique keys

Nếu không dùng table idempotency chung thì phải có unique constraints tương đương.

Khuyến nghị:

```text
id uuid
center_id uuid
operation text
idempotency_key text
request_hash text
result_json jsonb
status text
created_at timestamptz
```

Unique `(center_id, operation, idempotency_key)`.

---

# 6. DATABASE MIGRATION PLAN

Không viết một migration khổng lồ duy nhất nếu khó review.

Khuyến nghị:

```text
202609040001_extensions_enums.sql
202609040002_core_center_auth.sql
202609040003_education.sql
202609040004_staff_assignments.sql
202609040005_tuition.sql
202609040006_finance.sql
202609040007_payroll.sql
202609040008_fund_profit.sql
202609040009_audit_import.sql
202609040010_rls_helpers.sql
202609040011_rls_policies.sql
202609040012_views_rpc.sql
202609040013_indexes.sql
202609040014_seed_reference.sql
```

## 6.1 Enums hoặc CHECK

Có thể dùng Postgres enums hoặc `varchar + check`. Phải nhất quán.

Cần các domain:

```text
app_role:
ADMIN
ACCOUNTANT
TEACHER
ASSISTANT

period_status:
OPEN
CLOSING
CLOSED

class_status:
ACTIVE
INACTIVE

collection_method:
PER_SESSION
PREPAID

enrollment_status:
ACTIVE
LEFT

session_status:
SCHEDULED
COMPLETED
CANCELLED

attendance_status:
PRESENT
ABSENT
EXCUSED

staff_type:
TEACHER
ASSISTANT

assignment_role:
MAIN_TEACHER
ASSISTANT

tuition_status:
DRAFT
CONFIRMED
PAID
PARTIAL
UNPAID

adjustment_type:
DISCOUNT
CARRY_IN
CARRY_OUT
OPENING_DEBT
MANUAL

payment_method:
CASH
BANK_TRANSFER
OTHER

transaction_type:
INCOME
EXPENSE

payroll_status:
DRAFT
APPROVED
PAID
```

---

# 7. DATA CONSTRAINTS BẮT BUỘC

## 7.1 Tiền

Mọi tiền:

```sql
bigint
```

Check:

```sql
amount >= 0
```

Trường signed adjustment nếu cho phép âm phải document rõ.

## 7.2 Unique

Ít nhất:

```text
centers(code)
accounting_periods(center_id, year, month)
classes(center_id, code)
students(center_id, code)
staff(center_id, code)
attendance(session_id, enrollment_id)
student_session_evaluations(session_id, enrollment_id)
tuition_ledgers(period_id, enrollment_id)
```

## 7.3 Enrollment validity

Không được dùng duy nhất `students.class_id`.

Student → Enrollment → Class.

## 7.4 Financial immutability

Không hard delete:

- payments.
- payroll runs/items.
- audit.
- period close snapshot.

Payment sai → void.

---

# 8. INDEX PLAN

Tạo index cho:

```text
profiles(center_id, role)
classes(center_id, status)
students(center_id, status)
enrollments(class_id, status)
enrollments(student_id, status)
class_sessions(class_id, session_date)
class_sessions(period_id, status)
attendance(session_id)
attendance(enrollment_id)
student_session_evaluations(session_id)
class_assignments(class_id, staff_id)
class_assignments(period_id)
tuition_ledgers(period_id, status)
tuition_ledgers(enrollment_id)
payments(tuition_ledger_id, paid_at)
financial_transactions(period_id, transaction_date)
payroll_runs(period_id)
payroll_items(payroll_run_id, staff_id)
audit_logs(center_id, created_at)
audit_logs(resource_type, resource_id)
```

---

# 9. RLS PLAN — KHÔNG ĐƯỢC BỎ QUA

## 9.1 Helper DB functions

Tạo:

```sql
public.current_center_id()
public.current_app_role()
public.current_staff_id()
public.is_admin()
public.is_accountant()
public.is_teacher_or_assistant()
public.has_class_assignment(class_id uuid, on_date date default current_date)
```

Phải xử lý security definer cẩn thận, set `search_path`.

---

## 9.2 Policy theo role

### centers
- User đọc center của mình.
- Admin update center của mình nếu cần.

### profiles
- User đọc profile của mình.
- Admin đọc profile cùng center.
- Chỉ Admin/server đổi role.

### classes
- Admin/accountant đọc tất cả cùng center.
- Teacher/assistant đọc class được assignment.
- Admin CRUD.

### students
- Admin/accountant đọc toàn center.
- Teacher/assistant chỉ đọc student có active enrollment trong lớp được assignment.
- Admin CRUD.

### enrollments
Tương tự students.

### sessions
- Admin đọc/ghi.
- GV/TG đọc lớp mình.
- Generate qua EF.

### attendance
- SELECT theo class permission.
- Mutation ưu tiên qua EF.
- Nếu direct write bị mở thì RLS phải kiểm tra assignment.

### evaluations
- SELECT/UPSERT Admin/GV/TG lớp được assignment.
- Closed period → business function phải block.

### finance tables
`tuition_ledgers`, `payments`, `adjustments`, `financial_transactions`, `rewards`:
- Admin/accountant SELECT.
- Write quan trọng qua Edge Function.
- Không cho GV/TG.

### payroll
- Admin/accountant.
- Nếu sau này staff xem lương mình thì chỉ `staff_id = current_staff_id()`, nhưng không bắt buộc MVP.

### audit_logs
- Admin SELECT.
- Không client INSERT/UPDATE/DELETE.
- Server function insert.

### settings
- Admin.

### import
- Admin.

---

# 10. SHARED BACKEND FRAMEWORK

Tạo `_shared`.

## 10.1 `cors.ts`

Allowed origin:

- `http://localhost:4200`
- GitHub Pages URL production.
- Custom domain nếu có.

Có thể trả dynamic origin theo whitelist constant server-side.

## 10.2 `response.ts`

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
  traceId: string;
};
```

Helper:

```ts
ok(data, traceId, status?)
fail(code, message, traceId, status, details?)
```

## 10.3 `auth.ts`

Function:

```ts
requireUser(req)
requireRole(req, allowedRoles)
```

Không nhận role từ body.

## 10.4 `trace.ts`

Mỗi request:

```text
crypto.randomUUID()
```

Return trong response và audit.

## 10.5 `validation.ts`

Không phụ thuộc framework nặng nếu không cần.

Validate:
- UUID.
- required.
- number >= 0.
- enum.
- arrays.
- dates.

---

# 11. RPC / TRANSACTION PLAN

Edge Function qua `supabase-js` không tự đảm bảo multi-statement transaction.

Các nghiệp vụ nhiều bước phải implement bằng **Postgres RPC function** chạy transaction atomic.

Phải có tối thiểu RPC:

```text
rpc_record_payment(...)
rpc_generate_tuition(...)
rpc_create_tuition_adjustment(...)
rpc_carry_over_period(...)
rpc_save_payroll_run(...)
rpc_approve_payroll(...)
rpc_close_period(...)
rpc_bulk_attendance(...)
rpc_bulk_evaluation(...)
```

Edge Function:

```text
HTTP/auth/validation
  ↓
RPC
  ↓
PostgreSQL transaction
  ↓
response
```

Không thực hiện kiểu:

```text
insert payment
await
update ledger
await
insert audit
```

nếu failure giữa chừng có thể làm lệch tiền.

---

# 12. PHASE 0 — FOUNDATION

## P0-01 Remove env mechanism

- [ ] Xóa `.env.example`.
- [ ] Xóa `scripts/generate-env.mjs`.
- [ ] Xóa `src/environments`.
- [ ] Sửa package scripts.
- [ ] Sửa GitHub Pages workflow.
- [ ] Tạo `supabase.constants.ts`.
- [ ] Tạo `app.constants.ts`.
- [ ] Sửa SupabaseService.

### Gate

```bash
grep -R "environment.supabase" src
grep -R "SUPABASE_URL" src scripts package.json
```

Không còn runtime env dependency.

---

## P0-02 Generate Supabase types

Sau migrations:

```bash
npx supabase gen types typescript --local > src/app/core/supabase/database.types.ts
```

Commit generated types để FE/BE đồng bộ schema.

---

## P0-03 Global UI foundation

Tạo:

- Page header.
- Sidebar.
- Topbar.
- Table.
- Search input.
- Filter.
- Pagination.
- Empty state.
- Loading.
- Error state.
- Badge.
- Modal/confirm.
- Toast.
- Form field styles.

Không cần UI library nặng nếu deadline gấp.

---

## P0-04 Route architecture

Route tree:

```text
/login

/dashboard

/classes
/classes/new
/classes/:id
/classes/:id/schedule

/students
/students/new
/students/:id

/attendance
/attendance/:sessionId
/evaluations/:sessionId

/staff
/staff/:id
/assignments

/finance/tuition
/finance/tuition/:classId
/finance/payments/new
/finance/debts
/finance/transactions
/finance/rewards
/finance/fund-profit

/payroll

/reports/classes
/reports/students

/periods
/settings
/audit
/migration
```

---

# 13. PHASE 1 — AUTH + PROFILE + ROLE

## P1-01 Login — SCR-01

Route:

```text
/login
```

Features:

- email.
- password.
- show/hide password.
- submit.
- loading.
- invalid credential message.
- forgot password link/flow.
- redirect dashboard after login.

Supabase:

```ts
auth.signInWithPassword()
```

---

## P1-02 Auth session

`AuthService`:

```text
session$
user$
profile$
role$
isAuthenticated$
```

App boot:
1. getSession.
2. load profile.
3. subscribe auth changes.
4. clear state logout.

---

## P1-03 Guards

- `authGuard`.
- `guestGuard`.
- `roleGuard`.

Route metadata:

```ts
data: { roles: ['ADMIN', 'ACCOUNTANT'] }
```

Không chỉ hide menu; backend/RLS vẫn bảo vệ.

---

## P1-04 Admin bootstrap

Không tạo admin bằng FE public.

Dùng:
- Supabase Dashboard Auth.
- SQL bootstrap.

Sau login, profile phải map center.

---

# 14. PHASE 2 — ACCOUNTING PERIOD

## P2-01 SCR-26 `/periods`

Features:

- list tháng.
- current period.
- OPEN/CLOSING/CLOSED badge.
- tạo kỳ mới.
- preview close.
- close.
- xem kỳ cũ.
- không sửa tài chính kỳ CLOSED.

## P2-02 PeriodContextService

Global selector:

```text
currentPeriodId
currentYear
currentMonth
status
```

Dashboard/tuition/payroll/reports sử dụng.

---

# 15. PHASE 3 — CLASS MANAGEMENT

## P3-01 SCR-03 Classes list

Features:

- list.
- search code/name.
- filter grade.
- filter subject.
- status.
- pagination.
- create button Admin.
- click detail.

Columns:
- code.
- name.
- grade.
- subject.
- fee/session.
- collection method.
- status.
- main teacher.
- assistant.

---

## P3-02 SCR-04 Create class

Form:
- code.
- name.
- grade.
- subject.
- standard fee.
- collection method.
- note.
- weekly schedules.

Validation:
- code required/unique.
- grade valid.
- fee >= 0.
- at least one schedule optional depending class state.

Create:
1. class.
2. schedules.
3. optionally assignment.

Nếu multi-write cần transaction RPC hoặc cleanup safe.

---

## P3-03 SCR-05 Class detail

Tabs:

```text
Tổng quan
Học sinh
Lịch học
Điểm danh
Nhân sự
Học phí
```

Display:
- class master.
- active roster count.
- sessions current period.
- staff assignment.
- revenue current period nếu role tài chính.
- attendance summary.

---

## P3-04 SCR-06 Schedule

Features:
- weekly schedule CRUD.
- calendar/list sessions.
- generate month.
- add makeup session.
- cancel session.
- reschedule.
- completed flag.

---

# 16. PHASE 4 — STUDENT + ENROLLMENT

## P4-01 SCR-07 Student list

Filter:
- class.
- active/inactive.
- search code/name/parent phone.
- debt filter với Admin/Accountant.

Columns:
- code.
- name.
- active classes.
- status.
- parent phone.
- debt nếu có quyền.

---

## P4-02 SCR-08 Add student

Form:
- code.
- full name.
- student phone.
- parent name.
- parent phone.
- note.
- status.

Enrollment section:
- class.
- enrolled from.
- unit price override.
- tuition exempt.
- note.

Create student + enrollment.

---

## P4-03 SCR-09 Student detail

Tabs:

```text
Thông tin
Lớp học
Chuyên cần
Đánh giá
Học phí
Lịch sử
```

Aggregate:
- active enrollments.
- attendance.
- evaluation average.
- learning gaps.
- ledgers.
- payments.
- adjustments.

Finance tab hidden for GV/TG.

---

# 17. PHASE 5 — STAFF + ASSIGNMENT

## P5-01 SCR-13 Staff list

Fields:
- code.
- full name.
- type.
- phone.
- subject.
- status.

Admin CRUD.

Không hard delete nhân sự có history.

---

## P5-02 SCR-14 Staff detail

Tabs:
- profile.
- assignments.
- sessions.
- payroll history.

---

## P5-03 SCR-15 Assignment

Admin:
- select class.
- select staff.
- role.
- period hoặc date range.
- planned sessions.

Validation:
- assistant role cho TG.
- main teacher cho teacher.
- không tạo assignment duplicate overlapping không hợp lệ.

---

# 18. PHASE 6 — SESSION GENERATION

## EF-02 `generate-month-sessions`

### Request

```json
{
  "class_id": "uuid",
  "period_id": "uuid"
}
```

### Flow

1. auth Admin.
2. class exists.
3. period OPEN.
4. load class schedules effective trong period.
5. iterate dates.
6. create SCHEDULED sessions.
7. unique prevents duplicates.
8. return created/existing count.
9. audit.

### Acceptance

Chạy 2 lần:
- lần 1 tạo.
- lần 2 không duplicate.

---

# 19. PHASE 7 — ATTENDANCE

## P7-01 SCR-10 Select attendance session

Features:
- period.
- date.
- class.
- pending/completed.
- warning sessions đã qua chưa attendance.

GV/TG chỉ thấy class assigned.

---

## P7-02 SCR-11 Attendance

Roster lấy enrollment active tại session date.

UI:
- Student code/name.
- PRESENT.
- ABSENT.
- EXCUSED.
- note.
- mark all present.
- save.

Keyboard/quick actions nếu có thời gian.

---

## EF-03 `attendance-bulk-upsert`

Validation đúng BD:

1. JWT.
2. session exists.
3. period not CLOSED.
4. actor Admin hoặc assigned.
5. enrollment belongs class.
6. enrollment active on session date.
7. enum valid.

RPC transaction.

Audit:
- before/after relevant status.

---

# 20. PHASE 8 — STUDENT EVALUATION

## SCR-12 `/evaluations/:sessionId`

Fields từng HS:

- homework_score.
- understanding_score.
- attitude_score.
- learning_gap.
- comment.

Scale:
- nếu BD/form hiện tại dùng thang điểm cụ thể, giữ đúng.
- nếu schema chưa chốt scale, dùng numeric 0–10 và validate.

---

## EF-04 `evaluation-bulk-upsert`

Request:

```json
{
  "session_id": "uuid",
  "items": [
    {
      "enrollment_id": "uuid",
      "homework_score": 8,
      "understanding_score": 9,
      "attitude_score": 9,
      "learning_gap": "Phân số",
      "comment": "..."
    }
  ]
}
```

Same permission logic attendance.

---

# 21. PHASE 9 — TUITION ENGINE

Đây là module quan trọng nhất. Không được tính tiền ở Angular.

## 21.1 Effective unit price

```text
if enrollment.unit_price_override != null
    use override
else
    use class.standard_unit_fee
```

---

## 21.2 Collection method `PER_SESSION`

Formula:

```text
gross_amount =
  billable_sessions * unit_price

amount_due =
  gross_amount
  + opening_debt
  + positive_adjustments
  - discounts
```

Billable policy phải đặt server-side/system settings.

---

## 21.3 Collection method `PREPAID`

- fee theo plan/session rule.
- nghỉ/học bù/giảm tiền không sửa historical ledger tùy tiện.
- sinh adjustment cho kỳ phù hợp.

---

## EF-05 `tuition-preview`

### Request

```json
{
  "period_id": "uuid",
  "class_id": "uuid"
}
```

`class_id` optional.

Return từng HS:

```text
student
class
billable_sessions
unit_price
gross_amount
opening_debt
adjustments
amount_due
warnings[]
```

Không ghi DB.

---

## EF-06 `generate-tuition`

Dùng RPC transaction.

Flow:
1. period OPEN.
2. load source.
3. calculate.
4. snapshot.
5. upsert by `(period_id,enrollment_id)`.
6. nếu ledger CONFIRMED/PAID thì không overwrite trái phép.
7. audit.
8. return reconciliation totals.

---

# 22. PHASE 10 — TUITION UI

## SCR-16 `/finance/tuition`

BD gọi `tuition-summary`.

### Gap closure

Tạo thêm:

```text
EF-16 POST /functions/v1/tuition-summary
```

hoặc Postgres read view/RPC.

Để đúng route/data contract của SCR-16, khuyến nghị Edge Function `tuition-summary`.

Request:

```json
{
  "period_id": "uuid"
}
```

Return:
- total due.
- total paid.
- total debt.
- collection rate.
- per class summary.

---

## SCR-17 `/finance/tuition/:classId`

Table:
- student.
- unit price.
- billable sessions.
- gross.
- opening debt.
- discount.
- due.
- paid.
- debt.
- status.

Actions:
- preview.
- generate.
- create adjustment.
- record payment.

---

# 23. PHASE 11 — PAYMENTS

## SCR-18 `/finance/payments/new`

Input:
- student/class/ledger.
- amount.
- date/time.
- method.
- reference.
- note.

Validation:
- amount > 0.
- ledger exists.
- period not CLOSED.

---

## EF-07 `record-payment`

**Bắt buộc RPC transaction.**

Flow:

```text
BEGIN
  lock ledger
  validate
  insert payment
  calculate sum active payment
  update paid/debt/status
  audit
COMMIT
```

### Overpayment

Chọn behavior rõ:

- Cho phép overpayment thành credit adjustment; hoặc
- Block > remaining debt.

Với MVP: **block payment > debt** trừ khi business cần credit.

---

## Void payment

BD nói payment sai → void.

Cần implement action, dù BD chưa đặt EF riêng.

Có thể:

```text
EF-17 POST /functions/v1/void-payment
```

Request:
```json
{
  "payment_id": "uuid",
  "reason": "Nhập nhầm"
}
```

RPC:
- set voided_at.
- recalc ledger.
- audit.

Đây là supporting endpoint cần để BR-10 hoàn chỉnh.

---

# 24. PHASE 12 — DEBT / ADJUSTMENT / CARRY-OVER

## SCR-19 `/finance/debts`

Views:
- debt current.
- opening debt.
- adjustment.
- carry history.

Filters:
- period.
- class.
- student.
- debt > 0.

---

## EF-08 `create-tuition-adjustment`

Required:
- student/enrollment.
- period.
- type.
- amount.
- reason.

Audit mandatory.

---

## EF-09 `carry-over-period`

Flow:
1. source/target period valid.
2. target OPEN.
3. find eligible debt/credits.
4. check not carried.
5. create target adjustment.
6. link source.
7. mark/source metadata.
8. audit.
9. idempotent.

---

# 25. PHASE 13 — OTHER FINANCE

## SCR-20 `/finance/transactions`

Table:
- date.
- INCOME/EXPENSE.
- category.
- class optional.
- description.
- amount.
- attachment.

CRUD:
- Admin/Accountant.
- No hard delete after close.

Required fields from DQ-03:
- date.
- type.
- category.
- description.
- amount.

---

## SCR-21 `/finance/rewards`

Fields:
- period.
- student.
- class optional.
- amount.
- reason.
- note.

Reward counts as expense in profit calculation.

---

# 26. PHASE 14 — PAYROLL ENGINE

Payroll **không hard-code trong Angular**.

## 26.1 Policy

Default seed theo yêu cầu trung tâm:

```text
teacher_percent = 25%
assistant_percent = 15%
max_total_percent = 40%
rounding_step = 50,000 VND
```

Nếu class không có assistant:
- chỉ teacher component.
- không tự cộng 15% vào teacher trừ khi policy nói vậy.

Policy version có effective dates.

---

## EF-10 `calculate-payroll`

Request:

```json
{
  "period_id": "uuid",
  "dry_run": true
}
```

Load:
- class tuition revenue/actual recognized basis theo policy.
- class assignments.
- role.
- sessions taught/planned.
- policy.
- existing bonus/penalty draft nếu có.

Calculate:
- base.
- cap.
- rounding.
- bonus.
- penalty.
- final.

### Rounding

Define function rõ ràng.

Nếu “theo hệ 50”:
- round to nearest 50,000 hoặc floor/ceil theo policy.
- Không làm tổng vượt cap.

Khuyến nghị:
1. calculate raw.
2. floor xuống step 50k.
3. verify total <= cap.

---

## EF-11 `approve-payroll`

Admin only.

- payroll run DRAFT.
- validate totals.
- set APPROVED.
- lock item edits.
- audit.

---

## SCR-22 `/payroll`

Features:
- period.
- preview.
- list per staff/class.
- raw/base.
- percent.
- rounded.
- bonus.
- penalty.
- final.
- cap warning.
- save DRAFT.
- approve Admin.
- status.

---

# 27. PHASE 15 — FUND + PROFIT

## Profit formula

```text
profit_before_fund =
    tuition_income
  + other_income
  - payroll
  - student_rewards
  - other_expenses

fund_contribution =
  max(0, profit_before_fund * fund_percent)

distributable_profit =
  max(0, profit_before_fund - fund_contribution)
```

---

## SCR-23 `/finance/fund-profit`

Display:
- opening fund.
- contribution.
- withdrawal.
- closing fund.
- profit before fund.
- distributable.
- recipients.
- ratios.
- amounts.

Validation:
- total recipient ratio = 100%.

---

# 28. PHASE 16 — CLOSE PERIOD

## EF-12 `close-period-preview`

Return totals + blockers.

Blocker list:

- sessions đã qua chưa điểm danh nếu strict.
- missing tuition ledgers.
- enrollment/ledger mismatch.
- payroll chưa approved.
- invalid transactions.
- adjustment pending.
- profit ratio != 100%.
- unresolved import/data integrity errors.

---

## EF-13 `close-period`

Admin only.

Request:

```json
{
  "period_id": "uuid",
  "expected_version": 3
}
```

RPC:
1. lock period.
2. optimistic version check.
3. rerun blockers.
4. carry-over.
5. finalize fund.
6. finalize profit distribution.
7. status CLOSED.
8. audit.
9. commit.

Không tin preview cũ.

---

# 29. PHASE 17 — DASHBOARD

## SCR-02 `/dashboard`

Admin/Accountant full.

Teacher/Assistant:
- có thể render dashboard giới hạn: upcoming sessions, classes, pending attendance.
- không hiển thị finance.

---

## EF-01 `dashboard-summary`

Admin/accountant response:

```text
period
active_student_count
active_class_count
total_due
total_paid
total_debt
collection_rate
payroll_total
other_income
other_expense
student_rewards
profit_before_fund
fund_contribution
distributable_profit
class_summaries[]
alerts[]
```

Không thực hiện N+1 query.

Dùng SQL views/RPC aggregate.

---

# 30. PHASE 18 — REPORTS

## SCR-24 `/reports/classes`

Per class:
- roster.
- sessions.
- attendance.
- due.
- paid.
- debt.
- payroll.
- profit.

Filters:
- period.
- grade.
- class.

Export CSV optional nhưng nên có.

---

## SCR-25 `/reports/students`

Metrics:
- attendance rate.
- present.
- absent.
- excused.
- avg homework.
- avg understanding.
- avg attitude.
- latest learning gaps.
- latest comments.

Filters:
- period.
- class.
- student.

Teacher/TG chỉ lớp assigned.

---

## Supporting database views

Khuyến nghị:

```text
v_class_period_summary
v_student_attendance_summary
v_student_evaluation_summary
v_tuition_period_summary
v_finance_period_summary
```

Không expose data vượt quyền; view vẫn phải dùng RLS-safe underlying pattern hoặc security invoker.

---

# 31. PHASE 19 — SETTINGS

## SCR-27 `/settings`

Admin.

Sections:

### General
- center name.
- timezone.
- currency display.

### Tuition
- billable attendance policy.
- allow overpayment.
- default collection behavior.

### Payroll
- policy list.
- teacher %.
- assistant %.
- cap.
- rounding step.
- effective date.

### Fund
- fund percentage.
- distribution recipients.

### Security
- user/profile list.
- role assignment.
- active flag.

**Role changes phải audit.**

---

# 32. PHASE 20 — AUDIT

## SCR-28 `/audit`

Filters:
- date.
- actor.
- action.
- resource type.
- traceId.

Columns:
- timestamp.
- actor.
- action.
- resource.
- before.
- after.
- traceId.

Detail drawer:
- pretty JSON diff.

No mutation.

---

# 33. PHASE 21 — DATA INTEGRITY CHECK

## EF-14 `data-integrity-check`

Checks:

### DI-01
Active enrollment nhưng thiếu tuition ledger khi ledger đã generated.

### DI-02
Ledger không có valid enrollment.

### DI-03
Student active/roster mismatch.

### DI-04
Past completed/scheduled session chưa attendance.

### DI-05
Attendance có enrollment không thuộc class.

### DI-06
Financial transaction thiếu metadata.

### DI-07
Payroll > configured cap.

### DI-08
Approved payroll sum != run total.

### DI-09
Payment sum != ledger paid amount.

### DI-10
Debt formula mismatch.

### DI-11
Carry-over duplicated.

### DI-12
Profit distribution != 100%.

Return:

```json
{
  "errors": [],
  "warnings": [],
  "summary": {
    "errorCount": 0,
    "warningCount": 0
  }
}
```

---

# 34. PHASE 22 — EXCEL MIGRATION

## SCR-29 `/migration`

Flow:

1. Select Excel file.
2. Upload to Supabase Storage private bucket.
3. Create `import_jobs`.
4. Validate.
5. Show preview:
   - classes.
   - students.
   - staff.
   - attendance.
   - tuition.
   - finance.
   - payroll.
6. Show issues.
7. User resolves/blocking errors.
8. Import.
9. Reconciliation.
10. Mark completed.

---

## 34.1 Storage

Bucket:

```text
center-imports
```

Private.

Path:

```text
<center_id>/<import_job_id>/<file_name>
```

Admin only.

---

## 34.2 Parsing Excel

Supabase Edge Functions Deno có thể parse xlsx bằng package tương thích.

Nếu dependency gây bundle/runtime issue:
- Parse file ở Angular chỉ cho preview **nhưng không tin client**.
- Server vẫn phải validate normalized payload.
- Hoặc tạo import function xử lý ArrayBuffer server-side.

Ưu tiên server-side để đảm bảo audit/repeatable migration.

---

## EF-15 `import-center-workbook`

Modes:

```text
VALIDATE
IMPORT
RECONCILE
```

### VALIDATE
- parse workbook.
- map sheets.
- collect issues.
- no business writes.

### IMPORT
Order:
1. center/period.
2. class.
3. schedule.
4. staff.
5. assignments.
6. student.
7. enrollment.
8. sessions.
9. attendance.
10. tuition.
11. finance.
12. payroll.

### RECONCILE
Compare source totals.

---

## 34.3 Known Excel data issues bắt buộc bắt được

Theo BD:

### DQ-01
Roster 50 vs accounting 48.

### DQ-02
`#REF!` in carry-over.

### DQ-03
Expense thiếu metadata.

### DQ-04
Payroll default/rule mismatch.

### DQ-05
Session count/date formatting.

Không tự động biến `#REF!` thành 0.

---

# 35. RECONCILIATION TARGET THÁNG 08/2026

Sau import, báo cáo phải so:

```text
Classes: 4 active
Roster students: 50
Accounting students: 48 source rows
Total due: 14,485,000 VND
Total paid: 14,485,000 VND
Debt: 0
Payroll source snapshot: 5,794,000 VND
Other expenses: 6,270,898 VND
Profit before fund: 2,420,102 VND
Fund 10%: ~242,010 VND
Distributable: ~2,178,092 VND
```

Nếu hệ thống chuẩn hóa cho kết quả khác:
- không force cho bằng.
- reconciliation report phải giải thích từng chênh lệch.

---

# 36. SCREEN IMPLEMENTATION MATRIX — 29/29

| ID | Route | Phải hoàn thiện | Backend |
|---|---|---|---|
| SCR-01 | `/login` | Login/forgot/logout/session | Supabase Auth |
| SCR-02 | `/dashboard` | KPI + alerts | EF-01 |
| SCR-03 | `/classes` | list/filter/search | Data API |
| SCR-04 | `/classes/new` | create + schedule | Data API/RPC |
| SCR-05 | `/classes/:id` | aggregate tabs | Data API |
| SCR-06 | `/classes/:id/schedule` | schedules/sessions | EF-02 |
| SCR-07 | `/students` | list/filter/debt visibility | Data API |
| SCR-08 | `/students/new` | student+enrollment | Data API/RPC |
| SCR-09 | `/students/:id` | full history | Data API/views |
| SCR-10 | `/attendance` | session selector | Data API |
| SCR-11 | `/attendance/:sessionId` | bulk mark | EF-03 |
| SCR-12 | `/evaluations/:sessionId` | learning evaluation | EF-04 |
| SCR-13 | `/staff` | list/CRUD | Data API |
| SCR-14 | `/staff/:id` | assignment/payroll history | Data API |
| SCR-15 | `/assignments` | assignment management | Data API |
| SCR-16 | `/finance/tuition` | period/class totals | EF-16 |
| SCR-17 | `/finance/tuition/:classId` | ledger | EF-05/06 |
| SCR-18 | `/finance/payments/new` | payment | EF-07 |
| SCR-19 | `/finance/debts` | debt/adjustment/carry | EF-08/09 |
| SCR-20 | `/finance/transactions` | income/expense | Data API/secured write |
| SCR-21 | `/finance/rewards` | rewards | Data API/secured write |
| SCR-22 | `/payroll` | calc/approve | EF-10/11 |
| SCR-23 | `/finance/fund-profit` | fund/profit | EF-12/13 data |
| SCR-24 | `/reports/classes` | class reports | Views/RPC |
| SCR-25 | `/reports/students` | learning reports | Views/RPC |
| SCR-26 | `/periods` | open/close | EF-12/13 |
| SCR-27 | `/settings` | policies/roles | Data API/RPC |
| SCR-28 | `/audit` | audit search | Data API |
| SCR-29 | `/migration` | Excel migration | EF-15 |

---

# 37. EDGE FUNCTION MATRIX

Phải có tối thiểu:

| ID | Function | Status required |
|---|---|---|
| EF-01 | `dashboard-summary` | Required |
| EF-02 | `generate-month-sessions` | Required |
| EF-03 | `attendance-bulk-upsert` | Required |
| EF-04 | `evaluation-bulk-upsert` | Required |
| EF-05 | `tuition-preview` | Required |
| EF-06 | `generate-tuition` | Required |
| EF-07 | `record-payment` | Required |
| EF-08 | `create-tuition-adjustment` | Required |
| EF-09 | `carry-over-period` | Required |
| EF-10 | `calculate-payroll` | Required |
| EF-11 | `approve-payroll` | Required |
| EF-12 | `close-period-preview` | Required |
| EF-13 | `close-period` | Required |
| EF-14 | `data-integrity-check` | Required |
| EF-15 | `import-center-workbook` | Required |
| EF-16 | `tuition-summary` | Gap closure for SCR-16 |
| EF-17 | `void-payment` | Gap closure for BR-10 |

Optional if implemented via RLS-safe Data API/RPC:
- create/update financial transaction.
- reward mutation.
- manage roles.

Nếu các optional mutation có security/audit phức tạp, chuyển sang Edge Function.

---

# 38. API RESPONSE CONTRACT

Mọi Edge Function:

## Success

```json
{
  "success": true,
  "data": {},
  "error": null,
  "traceId": "uuid"
}
```

## Error

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Thông báo tiếng Việt dễ hiểu",
    "details": {}
  },
  "traceId": "uuid"
}
```

---

# 39. ERROR CODES CHUẨN

Tối thiểu:

```text
UNAUTHENTICATED
FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
CONFLICT
PERIOD_CLOSED
PERIOD_NOT_OPEN
CLASS_NOT_ASSIGNED
ENROLLMENT_NOT_ACTIVE
SESSION_CANCELLED
TUITION_ALREADY_CONFIRMED
PAYMENT_EXCEEDS_DEBT
PAYMENT_ALREADY_VOIDED
PAYROLL_ALREADY_APPROVED
PAYROLL_CAP_EXCEEDED
CARRY_OVER_ALREADY_PROCESSED
CLOSE_PERIOD_BLOCKED
IMPORT_VALIDATION_FAILED
DATA_INTEGRITY_ERROR
INTERNAL_ERROR
```

---

# 40. FRONTEND SERVICES

Không gọi Supabase rải rác trong component.

Tạo domain services:

```text
ClassService
StudentService
EnrollmentService
SessionService
AttendanceService
EvaluationService
StaffService
AssignmentService
TuitionService
PaymentService
FinanceService
PayrollService
FundProfitService
PeriodService
ReportService
SettingsService
AuditService
MigrationService
DashboardService
```

Service trả typed models.

Components tập trung UI/state.

---

# 41. FRONTEND STATE STRATEGY

Deadline gấp → **không bắt buộc NgRx**.

Dùng:
- Angular signals.
- RxJS khi cần stream.
- service store per feature.

Ví dụ:

```text
loading
error
items
filters
selectedPeriod
selectedClass
```

Không introduce global state framework nếu chưa cần.

---

# 42. FORM VALIDATION

Dùng Reactive Forms.

Rules:

### Money
- integer.
- >= 0.
- VND display formatter riêng.

### Phone
- optional.
- normalize whitespace.

### Date
- ISO internally.
- local display vi-VN.

### Score
- 0–10 nếu chưa có scale khác.

### Percent
- 0–100 UI.
- DB store ratio 0–1 hoặc percent consistent; chọn một convention và document.

Khuyến nghị DB:
```text
0.25 = 25%
```

---

# 43. UI/UX RULES

## 43.1 Desktop first nhưng responsive

Trung tâm quản trị chủ yếu desktop.

Breakpoints:
- desktop.
- tablet.
- mobile fallback.

## 43.2 Không nhồi quá nhiều dữ liệu

Financial table:
- sticky header.
- horizontal scroll.
- totals footer.

## 43.3 Dangerous action

Confirm dialog:
- void payment.
- approve payroll.
- close period.
- deactivate student/staff.
- import.

---

# 44. GITHUB PAGES ROUTING

Build:

```bash
ng build --configuration production --base-href "/<repo>/"
```

Sau build:
- copy `index.html` → `404.html` fallback.
- `.nojekyll`.

Nếu custom domain root:
- base href `/`.

Test:
- open `/dashboard`.
- refresh direct route.
- route không 404.

---

# 45. CI — FRONTEND

Workflow:

1. checkout.
2. setup Node >= 22.22.3.
3. npm ci.
4. test.
5. build.
6. upload Pages artifact.
7. deploy.

Không inject app env.

---

# 46. CI — SUPABASE

Use GitHub secrets, không `.env`.

Steps:
1. checkout.
2. setup Node.
3. npm ci.
4. `supabase link`.
5. DB migration deploy.
6. function deploy.

Nên tách deploy database/function khỏi FE để dễ rollback.

---

# 47. TEST PLAN — DATABASE

Viết SQL tests hoặc scripted tests cho:

## DB-T01 RLS center isolation
User center A không đọc center B.

## DB-T02 Teacher class scope
GV không đọc student lớp không assigned.

## DB-T03 Finance role
GV không đọc tuition/payments.

## DB-T04 Attendance unique
Không duplicate session+enrollment.

## DB-T05 Tuition ledger unique
Không duplicate period+enrollment.

## DB-T06 Closed period
RPC financial mutation fail.

## DB-T07 Payment atomicity
Nếu audit fail/validation fail, payment không insert dở.

## DB-T08 Carry-over idempotency
Call 2 lần không duplicate.

## DB-T09 Payroll cap
GV+TG không vượt max total percent.

## DB-T10 Audit immutability
Client không update/delete audit.

---

# 48. TEST PLAN — EDGE FUNCTIONS

Mỗi function test:

- no auth → 401.
- wrong role → 403.
- malformed body → 400.
- missing resource → 404.
- business conflict → 409/422.
- success.
- repeat request nếu idempotent.

Đặc biệt:

### EF-03
- teacher assigned pass.
- unassigned fail.
- enrollment different class fail.

### EF-06
- preview values.
- confirmed ledger not silently overwritten.

### EF-07
- payment.
- debt recalc.
- overpayment.
- closed period.

### EF-10
- 25% teacher.
- 15% assistant.
- max 40%.
- round 50k.

### EF-13
- blocker.
- expected version mismatch.
- successful close.

---

# 49. TEST PLAN — ANGULAR

Unit/component tests tối thiểu:

```text
AuthService
RoleGuard
MoneyUtil
ClassService
AttendanceService
TuitionService
PayrollService
PeriodService
```

Critical component:
- login.
- attendance.
- tuition ledger.
- payment form.
- payroll.
- close period dialog.

---

# 50. E2E / MANUAL SCENARIO

Nếu chưa setup Playwright, thực hiện manual checklist và có thể thêm Playwright sau.

## Scenario A — Daily teaching
1. Admin login.
2. Open period.
3. class exists.
4. generate sessions.
5. Teacher login.
6. select session.
7. attendance.
8. evaluation.
9. reload.
10. data persists.

## Scenario B — Tuition
1. attendance complete.
2. accountant preview.
3. generate.
4. verify unit override.
5. record payment.
6. debt updates.

## Scenario C — Payroll
1. revenue exists.
2. calculate.
3. check policy.
4. approve.
5. cannot edit approved.

## Scenario D — Close month
1. run preview.
2. blocker if missing.
3. resolve.
4. carry over.
5. close.
6. mutation now blocked.

---

# 51. SECURITY REVIEW

Checklist:

- [ ] Supabase URL/public key only in `supabase.constants.ts`.
- [ ] No service key in repo.
- [ ] No DB password in repo.
- [ ] No access token in repo.
- [ ] RLS on every public table.
- [ ] Storage bucket private for import.
- [ ] Role not accepted from request body.
- [ ] Finance mutations server-side.
- [ ] Audit server-side.
- [ ] No JWT logs.
- [ ] CORS whitelist.
- [ ] User input validated.
- [ ] Search/path SQL injection avoided through parameterized Supabase/RPC.

---

# 52. PERFORMANCE PLAN

Expected current scale nhỏ nhưng design không được N+1.

## Lists
- pagination.
- select only fields needed.

## Dashboard
- one aggregate RPC/view rather than dozens of client queries.

## Reports
- SQL aggregate view.

## Attendance
- bulk write.

## Evaluation
- bulk write.

Indexes per section 8.

---

# 53. DATA MIGRATION / SEED DEMO

Nếu chưa có file Excel runtime trong project:
- seed 4 classes from BD.
- seed staff reference.
- do not invent phone/student personal data beyond BD.

Seed class:

```text
L06 — Toán 6 — 50k — PER_SESSION
L07 — Toán 7 — 50k — PER_SESSION
L08 — Toán 8 — 50k — PER_SESSION
L09 — Toán 9 — 60k — PREPAID
```

Payroll default:
```text
Teacher 25%
Assistant 15%
Cap 40%
Rounding 50,000
```

---

# 54. IMPLEMENTATION ORDER — TUYỆT ĐỐI TUÂN THỦ

Luna làm theo thứ tự này để tránh làm UI trước DB:

```text
STEP 01  Audit init project
STEP 02  Remove env / create constants
STEP 03  Fix package + CI
STEP 04  Complete database schema
STEP 05  Complete constraints/indexes
STEP 06  Complete RLS helpers/policies
STEP 07  Complete SQL RPC transactions
STEP 08  Generate database.types.ts
STEP 09  Complete shared Edge Function framework
STEP 10  Implement all Edge Functions
STEP 11  Test Supabase local
STEP 12  Complete Angular auth
STEP 13  Complete shell/shared UI
STEP 14  Period module
STEP 15  Class/schedule module
STEP 16  Student/enrollment module
STEP 17  Staff/assignment module
STEP 18  Attendance
STEP 19  Evaluation
STEP 20  Tuition
STEP 21  Payment/debt/carry-over
STEP 22  Other finance/rewards
STEP 23  Payroll
STEP 24  Fund/profit
STEP 25  Dashboard
STEP 26  Reports
STEP 27  Settings
STEP 28  Audit
STEP 29  Migration
STEP 30  Role navigation polish
STEP 31  Unit tests
STEP 32  Integration/business tests
STEP 33  Full build
STEP 34  Fix all failures
STEP 35  GitHub Pages test
STEP 36  Supabase deploy readiness
STEP 37  Final BD reconciliation report
```

Không đảo:
- Tuition trước attendance/session.
- Payroll trước finance.
- UI trước RLS.

---

# 55. CHECKPOINT SAU MỖI STEP

Sau mỗi step ghi vào:

```text
docs/IMPLEMENTATION_PROGRESS.md
```

Format:

```md
## STEP 18 — Attendance

Status: DONE

Implemented:
- ...
- ...

Files:
- ...

Tests:
- ...

BD mapping:
- BR-05
- UC-07
- AC-02
- SEQ-03
- SCR-10
- SCR-11
- EF-03

Known issues:
- None
```

Không ghi DONE khi test chưa pass.

---

# 56. TRACEABILITY MATRIX BẮT BUỘC

Tạo cuối project:

```text
docs/BD_TRACEABILITY_MATRIX.md
```

Columns:

```text
BD ID
Type
Description
Implementation files
Test
Status
```

Bao gồm:
- ACT.
- DQ.
- TBL.
- BR.
- UC.
- AC.
- SEQ.
- DA.
- EF.
- SCR.
- Acceptance Criteria.

Status cuối cùng không được có `NOT_IMPLEMENTED`.

---

# 57. BUILD FAILURE POLICY

Nếu build fail:

1. đọc error đầu tiên.
2. fix root cause.
3. rerun.
4. không suppress TypeScript bằng `any` bừa.
5. không disable strict chỉ để pass.
6. không comment code nghiệp vụ.
7. không bỏ route/component lỗi khỏi build.

Nếu test fail:
- sửa code hoặc test nếu test sai nghiệp vụ.
- không `.skip` critical test.

---

# 58. CLEAN CODE RULES

## Angular
- standalone components.
- inject() hoặc constructor nhất quán.
- typed Reactive Forms.
- no giant 1000-line component.
- business logic nằm service/server.
- strict typing.

## SQL
- migration deterministic.
- no destructive reset in production migration.
- comment business RPC.
- use locking/version where needed.

## Edge
- small handler.
- shared auth/response.
- RPC for atomic operations.
- no secret in log.

---

# 59. DOCUMENTATION PHẢI CẬP NHẬT

Sau hoàn thành sửa:

## README.md
Phải có:
- prerequisites.
- Supabase constants config.
- local Supabase.
- admin bootstrap.
- run.
- test.
- build.
- deploy Pages.
- deploy Supabase.
- architecture.

Không hướng dẫn `.env`.

## AGENTS.md
Thêm:
- plan path.
- no-env rule.
- build/test gates.

## docs/IMPLEMENTATION_NOTES.md
Ghi gap closure:
- EF-16 tuition-summary.
- EF-17 void-payment.
- import support tables.
- transaction RPC design.

---

# 60. FINAL VALIDATION COMMANDS

## 60.1 Static scan

```bash
grep -R "service_role" src || true
grep -R "SUPABASE_SECRET" src || true
grep -R "process.env" src || true
grep -R "environment\\." src || true
grep -R "TODO" src supabase || true
```

Review từng output.

---

## 60.2 FE

```bash
npm ci
npm test
npm run build
```

---

## 60.3 Supabase

```bash
npx supabase start
npx supabase db reset
npx supabase status
npx supabase functions serve
```

Smoke call:
- health.
- dashboard with auth.
- attendance.
- tuition.
- payment.
- payroll.

---

# 61. FINAL ACCEPTANCE — BUSINESS

## AUTH
- [ ] login/logout.
- [ ] session persistence.
- [ ] 4 roles.
- [ ] route permissions.

## CLASS
- [ ] create/edit/deactivate.
- [ ] schedule.
- [ ] sessions.
- [ ] class detail.

## STUDENT
- [ ] create/edit/deactivate.
- [ ] enrollment.
- [ ] unit override.
- [ ] history.

## ATTENDANCE
- [ ] C/P/N equivalent mapped.
- [ ] bulk.
- [ ] class permission.
- [ ] closed period lock.

## EVALUATION
- [ ] BTVN.
- [ ] understanding.
- [ ] attitude.
- [ ] gap.
- [ ] comment.

## TUITION
- [ ] PER_SESSION.
- [ ] PREPAID.
- [ ] unit override.
- [ ] opening debt.
- [ ] discount.
- [ ] preview.
- [ ] generate.
- [ ] ledger snapshot.

## PAYMENT
- [ ] create.
- [ ] debt recalc.
- [ ] partial.
- [ ] paid.
- [ ] void.
- [ ] audit.

## CARRY
- [ ] adjustment.
- [ ] carry.
- [ ] idempotent.

## FINANCE
- [ ] income.
- [ ] expense.
- [ ] reward.
- [ ] required metadata.

## PAYROLL
- [ ] teacher policy.
- [ ] assistant policy.
- [ ] cap.
- [ ] round 50k.
- [ ] bonus.
- [ ] penalty.
- [ ] draft.
- [ ] approve.

## FUND/PROFIT
- [ ] fund.
- [ ] profit.
- [ ] recipient ratio.
- [ ] amount.

## PERIOD
- [ ] open.
- [ ] preview.
- [ ] blockers.
- [ ] close.
- [ ] lock.

## REPORT
- [ ] class.
- [ ] student.
- [ ] finance dashboard.

## AUDIT
- [ ] actions.
- [ ] before/after.
- [ ] traceId.

## MIGRATION
- [ ] upload.
- [ ] validate.
- [ ] issues.
- [ ] import.
- [ ] reconcile.

---

# 62. FINAL ACCEPTANCE — 29 ROUTES

Luna chạy route smoke test và ghi status:

```text
/login                           PASS
/dashboard                       PASS
/classes                         PASS
/classes/new                     PASS
/classes/:id                     PASS
/classes/:id/schedule            PASS
/students                        PASS
/students/new                    PASS
/students/:id                    PASS
/attendance                      PASS
/attendance/:sessionId           PASS
/evaluations/:sessionId          PASS
/staff                           PASS
/staff/:id                       PASS
/assignments                     PASS
/finance/tuition                 PASS
/finance/tuition/:classId        PASS
/finance/payments/new            PASS
/finance/debts                   PASS
/finance/transactions            PASS
/finance/rewards                 PASS
/payroll                         PASS
/finance/fund-profit             PASS
/reports/classes                 PASS
/reports/students                PASS
/periods                         PASS
/settings                        PASS
/audit                           PASS
/migration                       PASS
```

Không route nào được placeholder.

---

# 63. FINAL REPORT FORMAT

Khi thực thi xong, GPT Luna phải trả report:

```md
# IMPLEMENTATION COMPLETION REPORT

## Build
- npm test: PASS
- npm run build: PASS
- supabase db reset: PASS
- functions smoke tests: PASS

## BD coverage
- Tables: 24/24 + support tables
- Business Rules: 16/16
- Screens: 29/29
- BD Edge Functions: 15/15
- Technical gap functions: 2/2
- RLS: PASS
- Migration: PASS
- Reconciliation: ...

## Deployment
- GitHub Pages: READY/PASS
- Supabase migrations: READY/PASS
- Edge Functions: READY/PASS

## Remaining limitations
- NONE
```

Nếu có limitation thật:
- mô tả chính xác.
- không tuyên bố 100%.

---

# 64. LỆNH KHỞI ĐỘNG CHO GPT LUNA

Khi nhận project + plan, bắt đầu:

```text
1. Read docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md completely.
2. Read PLAN_GPT_LUNA_FULL_SYSTEM.md completely.
3. Inspect current source tree.
4. Create docs/IMPLEMENTATION_PROGRESS.md.
5. Execute STEP 01 → STEP 37 in order.
6. Do not stop at partial UI.
7. Do not use .env/environment.ts for Supabase frontend config.
8. Put Supabase URL + publishable key in src/app/core/config/supabase.constants.ts.
9. Never put service-role/secret credentials in frontend constants.
10. Run all build/test gates and fix failures.
11. Complete BD traceability matrix.
12. Return final completion report only after the system is actually buildable.
```

---

# 65. NGUYÊN TẮC CUỐI CÙNG

**Ưu tiên correctness nghiệp vụ hơn abstraction.**

Hệ thống này đang thay thế Excel vận hành thật, vì vậy:

- Không làm UI giả.
- Không tính tiền ở FE.
- Không phụ thuộc công thức Excel.
- Không tạo quan hệ student-class kiểu đơn giản làm mất history.
- Không xóa transaction tài chính.
- Không bỏ RLS.
- Không bỏ transaction.
- Không bỏ audit.
- Không hard-code tỷ lệ lương trong Angular.
- Không dùng `.env`.
- Không expose secret.
- Không đóng tháng khi có blocker.
- Không import lỗi `#REF!` thành dữ liệu hợp lệ.
- Không tuyên bố xong nếu chưa build/test.

**Kết quả cuối cùng phải là một hệ thống Angular + Supabase hoàn chỉnh, chạy được, build được, deploy được và bao phủ 100% nghiệp vụ trong BD.**
