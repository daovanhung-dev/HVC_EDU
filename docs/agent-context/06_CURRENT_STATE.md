# 06 — Current State Snapshot

> Snapshot: 04/09/2026. Đây là file trạng thái động; luôn kiểm tra HEAD/CI mới hơn nếu đang làm task sau thời điểm này.

## 1. Repository state

Nhánh chuẩn: `main`.

Commit HEAD tại thời điểm context được tạo:

```text
f28d16f8746055815e2f7d4406612df32fa64248
```

Commit này tập trung vào:

- sửa trigger `updated_at` không phù hợp;
- cleanup import artifact;
- staff email/account;
- profile read policy;
- audited RPC update class/staff/student/enrollment;
- revoke direct writes trên key tables;
- unique master keys;
- enrollment terminal/re-entry guard.

## 2. Implementation progress

Theo `docs/IMPLEMENTATION_PROGRESS.md`:

- Foundation/schema/RLS/RPC/Edge framework: implemented.
- Remote Supabase migrations đã từng được apply đến chuỗi migration hiện tại được ghi nhận trong progress.
- Auth/shell/period/education/finance/payroll/reports/settings/audit/migration: implemented.
- 29 route yêu cầu đã được wiring trong Angular.
- Unit tests hiện có cho money/date/API error mapping.
- Angular production build đã PASS trong implementation verification.
- Deno function checks đã PASS trong implementation verification.

Không suy ra rằng mọi runtime path production đều đã acceptance test chỉ vì build/type-check pass.

## 3. Frontend deployment

Workflow `Deploy Angular to GitHub Pages` ở cùng HEAD hiện tại đã chạy SUCCESS.

Pipeline đã:

- install dependencies;
- test;
- build Angular;
- dùng repository base href;
- tạo SPA `404.html` fallback;
- deploy Pages.

Do đó nếu production UI lỗi, không mặc định chẩn đoán là "Pages chưa build"; phải xem route/base href/runtime API/auth cụ thể.

## 4. Supabase deployment CI — cảnh báo hiện tại

Workflow `Deploy Supabase` ở HEAD hiện tại đang FAILURE tại bước `Link Supabase project`.

Log cho thấy trong GitHub Actions các biến sau được resolve thành rỗng tại job:

- `SUPABASE_ACCESS_TOKEN`;
- `SUPABASE_DB_PASSWORD`;
- `SUPABASE_PROJECT_REF`.

CLI báo access token chưa được cung cấp, sau đó các bước config/db/functions bị skip.

Điều này là vấn đề **CI credential configuration**, không phải bằng chứng migration/code SQL hiện tại lỗi.

Khi fix CI, cấu hình đúng:

- Repository/Environment Secret `SUPABASE_ACCESS_TOKEN`;
- Repository/Environment Secret `SUPABASE_DB_PASSWORD`;
- Repository/Environment Variable `SUPABASE_PROJECT_REF`;
- kiểm tra workflow có truy cập đúng scope/environment chứa các giá trị trên.

Không commit credential vào YAML để chữa lỗi này.

## 5. Remote Supabase / frontend config

Frontend constants hiện trỏ tới Supabase project production được cấu hình và chỉ chứa public URL/publishable key.

Không chuyển secret key vào frontend.

Progress trước đó ghi nhận remote project đã được deploy/import workbook trực tiếp từ workspace, dù CI Supabase hiện tại đang thiếu credential.

Hai sự thật này không mâu thuẫn: remote có thể đã được deploy thủ công/ở phiên credential khác, trong khi GitHub Actions hiện không có credential.

## 6. Workbook reconciliation snapshot

Tháng 08/2026 sau import/reconcile:

- tuition due: 14.485.000 VND;
- tuition paid: 14.485.000 VND;
- payroll: 5.794.000 VND;
- other expenses: 6.270.898 VND;
- fund contribution: 242.010 VND;
- distributable profit: 2.178.092 VND.

Source warnings được giữ:

- 2 học sinh L09 có roster nhưng không có accounting row;
- 153 attendance cells blank;
- 2 expense rows thiếu metadata đầy đủ và dùng explicit fallback theo import decision;
- 9 `#REF!` cells bị ignore + warning, không convert thành 0.

## 7. Known environment limitation

Supabase local full validation cần Docker/Podman.

Trong môi trường implementation trước đó không có Docker/Podman nên:

- local `supabase db reset` không chạy được;
- local schema lint/full generated type refresh bị giới hạn;
- `database.types.ts` không nên được coi là generated remote schema snapshot tuyệt đối.

## 8. Cách Agent dùng snapshot này

- Dùng để tránh lặp lại investigation đã biết.
- Trước khi nói "hiện tại", kiểm tra commit/workflow mới nhất nếu có quyền truy cập GitHub.
- Nếu HEAD khác snapshot đáng kể, cập nhật file này sau khi hoàn tất task liên quan.

## 9. Rebuild workflow working tree (06/09/2026)

The current working tree contains the additive HVC_EDU workflow rebuild:

- Angular routes are hub-first (`home`, `month-setup`, `education`, `teaching`, `finance`, `people`, `notifications`, `settings`) with legacy redirects.
- Migration `202609060001_rebuild_workflows.sql` adds period snapshots, per-session staff work attendance, staff availability and recipient-scoped notifications, plus atomic month setup and related RPCs.
- New Edge Functions cover month setup preview/create, work attendance submit/review, availability and notification inbox/send operations.
- Angular checks and Deno checks pass with temporary Node 22.22.3; local Supabase lint/reset remains blocked because Docker/Podman/Postgres is unavailable. The new migration/functions are not yet reflected in the remote deployment until an explicit deployment step is run.
