# 01 — Project Structure

## 1. Tổng quan repository

```text
HVC_EDU/
├── AGENTS.md
├── README.md
├── angular.json
├── package.json
├── package-lock.json
├── src/
│   └── app/
│       ├── app.component.ts
│       ├── app.config.ts
│       ├── app.routes.ts
│       ├── core/
│       │   ├── api/
│       │   ├── auth/
│       │   ├── config/
│       │   ├── guards/
│       │   ├── services/
│       │   ├── supabase/
│       │   └── utils/
│       ├── layout/
│       └── features/
│           ├── auth/
│           ├── dashboard/
│           ├── classes/
│           ├── students/
│           ├── attendance/
│           ├── staff/
│           ├── finance/
│           ├── periods/
│           ├── reports/
│           ├── settings/
│           ├── audit/
│           ├── migration/
│           └── not-found/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
│       ├── _shared/
│       └── <business-function>/
├── docs/
│   ├── BD_HeThong_QuanLy_TrungTam_HungCuong.md
│   ├── BD_TRACEABILITY_MATRIX.md
│   ├── IMPLEMENTATION_NOTES.md
│   ├── IMPLEMENTATION_PROGRESS.md
│   ├── SQL_TEST_PLAN.md
│   ├── excels/
│   ├── tasks/
│   └── agent-context/
└── .github/
    └── workflows/
        ├── deploy-pages.yml
        └── deploy-supabase.yml
```

## 2. Trách nhiệm từng vùng

### `src/app/core`

Dùng cho concern dùng chung toàn hệ thống, không chứa business UI cụ thể.

- `api/`: chuẩn hóa Edge Function call, API response/error.
- `auth/`: session/profile/auth state.
- `config/`: application constants và public Supabase config.
- `guards/`: auth, guest, role route guards.
- `services/`: shared application services/context services.
- `supabase/`: Supabase client, DB types/contract, helper.
- `utils/`: money/date/helper functions.

### `src/app/layout`

Application shell: navigation, layout chung, period context và vùng chứa route.

### `src/app/features`

Feature-oriented. Component/service/query của một nghiệp vụ nên ở module tương ứng thay vì dồn vào `core`.

Feature hiện có:

- `auth`: login/reset password.
- `dashboard`: KPI/tổng quan.
- `classes`: danh sách, tạo/sửa, detail, schedule.
- `students`: danh sách, tạo/sửa, detail, enrollment history/re-entry.
- `attendance`: danh sách buổi, điểm danh và evaluation theo session.
- `staff`: nhân sự, tài khoản, phân công.
- `finance`: tuition, payment, debts, transactions, rewards, payroll, fund/profit.
- `periods`: kỳ kế toán/tháng, preview/close/carry-over.
- `reports`: báo cáo lớp/học sinh.
- `settings`: cấu hình trung tâm/policy.
- `audit`: nhật ký thay đổi.
- `migration`: import/reconciliation workbook.

## 3. Routing model

`src/app/app.routes.ts` là bản đồ UI chính.

Vai trò hiện tại:

- `ADMIN`
- `ACCOUNTANT`
- `TEACHER`
- `ASSISTANT`

Nhóm route:

- Public/guest: `/login`, `/reset-password`.
- Authenticated shell: toàn bộ route nghiệp vụ.
- Role guard kiểm soát module theo `data.roles`.

Các route nghiệp vụ quan trọng:

```text
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

## 4. Backend structure

### `supabase/migrations`

Không chỉ chứa schema. Đây là nơi định nghĩa:

- enums/types;
- tables/constraints/indexes;
- triggers;
- RLS/policies;
- RPC functions;
- permission grants/revokes;
- seed/reference data;
- migration fixes.

Agent phải đọc migration liên quan trước khi sửa query hoặc mutation FE.

### `supabase/functions`

Mỗi thư mục là một Edge Function nghiệp vụ. `_shared/` chứa helper dùng chung như:

- auth/context;
- response envelope;
- validation;
- RPC invocation;
- idempotency;
- error mapping.

Các function tiêu biểu:

```text
health
dashboard-summary
generate-month-sessions
attendance-bulk-upsert
evaluation-bulk-upsert
tuition-preview
generate-tuition
tuition-summary
record-payment
void-payment
create-tuition-adjustment
carry-over-period
calculate-payroll
approve-payroll
close-period-preview
close-period
data-integrity-check
import-center-workbook
update-profile-role
invite-staff-account
```

Danh sách thực tế có thể nhiều hơn; khi task đụng backend phải liệt kê lại `supabase/functions/` thay vì dựa hoàn toàn vào file context này.

## 5. Dependency direction

Ưu tiên dependency một chiều:

```text
Feature Component
  ↓
Feature/Core Service
  ↓
Supabase Data API hoặc EdgeFunctionService
  ↓
RLS / Edge Function
  ↓
RPC transaction
  ↓
PostgreSQL tables + audit
```

Không để component tự chứa business calculation tài chính phức tạp.

## 6. Naming

- DB/table/column/function SQL: `snake_case`.
- Angular route/feature: `kebab-case`.
- Edge Function: `kebab-case`.
- TypeScript class/type: PascalCase.
- TypeScript variable/function: camelCase.
