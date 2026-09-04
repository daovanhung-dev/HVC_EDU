# 04 — Project Workflow

Tài liệu này mô tả cả **workflow phát triển** và **workflow nghiệp vụ/runtime**. AI Agent phải hiểu cả hai.

# A. Development Workflow

## A1. Nhận task

Trước khi code:

1. Xác định actor bị ảnh hưởng.
2. Xác định module/route.
3. Đọc BD/business rule tương ứng.
4. Đọc code hiện tại từ UI xuống DB.
5. Kiểm tra traceability/implementation notes.
6. Xác định thay đổi có cần migration/RPC/Edge Function hay chỉ FE.

Không bắt đầu bằng việc sửa component nếu chưa hiểu mutation path.

## A2. Impact analysis

Trace tối thiểu:

```text
Route
→ Component
→ Service/helper
→ Supabase Data API hoặc Edge Function
→ RPC
→ table/constraint/RLS
→ audit/idempotency
→ tests
```

Với finance/payroll/period/import/auth role, bắt buộc kiểm tra toàn chain.

## A3. Thiết kế thay đổi

Ưu tiên sửa tại đúng lớp chịu trách nhiệm:

- UI presentation → Angular component/style.
- shared FE behavior → core/shared service/helper.
- authorization → RLS/RPC/Edge auth, không chỉ ẩn nút.
- business validation → server/RPC.
- atomic multi-write → PostgreSQL RPC transaction.
- public API behavior → Edge Function.
- schema/invariant → migration.

## A4. Implement

### FE-only task

1. giữ lazy standalone architecture;
2. reuse service/helper hiện có;
3. giữ loading/error/empty state;
4. role-aware UI;
5. không nhân bản calculation authoritative.

### Backend task

1. tạo migration mới, không sửa lịch sử migration đã apply nếu không có lý do đặc biệt;
2. thêm/điều chỉnh constraint/index/RLS/RPC;
3. cập nhật Edge Function nếu public contract thay đổi;
4. cập nhật FE service/call site;
5. cập nhật docs/traceability nếu business behavior thay đổi.

## A5. Test workflow

Tối thiểu:

```bash
npm ci
npm test
npm run build
```

Edge Function type check:

```bash
deno check --no-config --node-modules-dir=auto \
  supabase/functions/_shared/*.ts \
  supabase/functions/*/index.ts
```

Nếu local Supabase khả dụng:

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

Sau đó chạy SQL/RLS/business smoke test liên quan.

## A6. Definition of Done

Một task chưa DONE nếu chỉ "build pass" nhưng:

- sai business rule;
- bypass RLS/RPC;
- thiếu role check;
- phá audit/history;
- không xử lý error/loading;
- chưa test critical path;
- docs/context cần cập nhật nhưng chưa cập nhật.

# B. Git / CI / Deployment Workflow

## B1. Frontend — GitHub Pages

Trigger:

- push `main`;
- manual workflow dispatch.

Pipeline:

```text
checkout
→ setup Node 22.22.3
→ npm ci
→ npm test
→ Angular production build
→ base-href /HVC_EDU/
→ copy index.html → 404.html
→ upload Pages artifact
→ deploy GitHub Pages
```

GitHub Pages là SPA static hosting; backend không chạy trên GitHub Pages.

## B2. Supabase

Trigger:

- push `main` có thay đổi `supabase/**`;
- manual workflow dispatch.

Pipeline:

```text
checkout
→ setup Node
→ npm ci
→ supabase link
→ config push
→ db push
→ functions deploy
→ functions list
```

CI cần:

- GitHub Secret `SUPABASE_ACCESS_TOKEN`;
- GitHub Secret `SUPABASE_DB_PASSWORD`;
- GitHub Variable `SUPABASE_PROJECT_REF`.

Không hard-code các giá trị secret vào workflow/source.

# C. Runtime Business Workflow

## C1. Auth startup

```text
User mở app
→ AuthService restore Supabase session
→ load profile/role/center
→ authGuard
→ roleGuard
→ App Shell
→ period context
→ feature route
```

## C2. Đầu kỳ/tháng

```text
Admin/finance chọn hoặc tạo accounting period
→ kiểm tra settings/policy
→ tạo/generate class sessions từ schedules khi cần
→ xác nhận assignment/enrollment scope
```

## C3. Vận hành lớp học

```text
Class schedule
→ class session
→ roster từ active enrollments
→ attendance
→ evaluations
→ reporting học tập
```

## C4. Học phí

```text
Period + sessions + enrollments + unit price
→ tuition preview
→ validate warnings
→ generate tuition ledgers
→ adjustments/carry-in nếu có
→ record payments
→ debt summary
```

Payment không được hard-delete. Void phải giữ history/audit.

## C5. Payroll

```text
Period
→ class revenue/assignment/policy
→ calculate-payroll Edge Function
→ transactional RPC tạo draft
→ review breakdown
→ approve-payroll
→ approved snapshot được bảo toàn
```

## C6. Thu chi / quỹ / lợi nhuận

```text
Tuition/revenue
+ financial transactions
+ payroll
+ rewards/other costs
→ finance summary
→ fund contribution
→ profit distribution
```

## C7. Đóng kỳ

```text
close-period-preview
→ data integrity/business validations
→ kiểm tra tuition/payment/debt
→ kiểm tra payroll/finance
→ close-period transaction
→ carry outstanding debt sang next open period nếu phù hợp
→ audit + immutable/history-safe state
```

Đây là luồng critical nhất; không sửa một phần mà không regression các phần còn lại.

## C8. Import workbook

```text
Admin upload Excel
→ private storage
→ server validation
→ import job
→ normalized RPC import
→ issue/warning records
→ data-integrity-check
→ reconciliation
```

`#REF!`, blank attendance và source mismatch phải được báo cáo, không tự động biến thành dữ liệu giả.

# D. Bugfix Workflow cho AI Agent

Khi user báo "màn X lỗi":

1. reproduce/đọc log nếu có;
2. xác định lỗi UI, auth/RLS, API, RPC, schema hay data;
3. tìm request/function chính xác;
4. đọc error mapping/traceId;
5. fix nguyên nhân gốc;
6. thêm regression test phù hợp;
7. chạy quality gates;
8. kiểm tra CI/deploy nếu bug liên quan production.

Không vá UI để che lỗi backend.
