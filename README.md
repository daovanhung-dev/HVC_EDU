# Hùng Cường Center Management

Init project cho hệ thống quản lý trung tâm Hùng Cường theo BD trong `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md`.

## Stack

- Angular 22.x, standalone components.
- Supabase Auth + PostgreSQL + RLS + Data API.
- Supabase Edge Functions (TypeScript/Deno, `@supabase/server@^1`).
- GitHub Pages cho Angular SPA.
- GitHub Actions cho FE và Supabase.

## Yêu cầu môi trường

- Node.js **>= 22.22.3**.
- npm.
- Docker nếu muốn chạy toàn bộ Supabase local (`supabase start`).

## 1. Cài dependencies

```bash
npm install
```

## 2. Chạy Supabase local

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

Lấy `API URL` và **publishable key** từ `supabase status`, sau đó cập nhật
`src/app/core/config/supabase.constants.ts` (chỉ đặt public/publishable key), rồi:

```bash
npm start
```

Angular chạy tại `http://localhost:4200`.

## 3. Tạo tài khoản Admin đầu tiên

1. Vào Supabase Studio/Auth và tạo user (signup đang tắt trong local config).
2. Copy UUID user.
3. Chạy SQL sau trong SQL Editor:

```sql
insert into public.profiles(user_id, center_id, full_name, role, active)
select
  'USER_UUID'::uuid,
  c.id,
  'Đào Văn Hùng',
  'ADMIN'::public.app_role,
  true
from public.centers c
where c.code = 'HC';
```

Sau đó đăng nhập trên `/login`.

## 4. Edge Functions

Serve local:

```bash
npx supabase functions serve
```

Health check:

```bash
curl http://127.0.0.1:54321/functions/v1/health
```

Các function hiện có:

- `health`
- `dashboard-summary`
- `attendance-bulk-upsert`
- `generate-month-sessions`, `evaluation-bulk-upsert`
- `tuition-preview`, `generate-tuition`, `tuition-summary`
- `record-payment`, `void-payment`, `create-tuition-adjustment`, `carry-over-period`
- `calculate-payroll`, `approve-payroll`, `close-period-preview`, `close-period`
- `data-integrity-check`, `import-center-workbook`, `update-profile-role`, `invite-staff-account`

Các nghiệp vụ tài chính, payroll, đóng kỳ và thay đổi quyền đều đi qua Edge Function → RPC transaction → audit log.

## 5. Generate DB types

Sau khi migration ổn định:

```bash
npm run supabase:types
```

> Khi có Supabase local, chạy lệnh trên để refresh type contract theo migration. Workspace hiện giữ một contract tối thiểu để frontend vẫn biên dịch khi Docker chưa có.

## 6. Deploy GitHub Pages

Repository Settings → Pages → Source = **GitHub Actions**.

Publishable key được phép xuất hiện ở browser trong file constants; **không đặt
secret/service key vào Angular**.

Push `main` sẽ chạy `.github/workflows/deploy-pages.yml`.

Workflow tự:

1. Build Angular với `base-href /<repo>/`.
2. Tạo `404.html` fallback cho SPA route.
3. Deploy Pages.

Nếu dùng custom domain ở root, đổi `--base-href` thành `/`.

## 7. Deploy Supabase

Tạo GitHub Repository Variable/Secrets:

Variables:
- `SUPABASE_PROJECT_REF` (tùy chọn; nếu bỏ trống workflow dùng `project_id` trong
  `supabase/config.toml`)

Secrets:
- `SUPABASE_ACCESS_TOKEN` — Supabase Personal Access Token có dạng `sbp_...`.
- `SUPABASE_DB_PASSWORD` — mật khẩu database remote.

Workflow sẽ validate các giá trị trước bước `supabase link` và không in token
hoặc mật khẩu vào log. Nếu dùng Environment Secrets/Variables thay vì cấp
Repository, job phải khai báo đúng `environment` tương ứng; mặc định workflow
này đọc Repository Secrets/Variables.

Sau đó chạy workflow `Deploy Supabase` hoặc push thay đổi trong `supabase/**`.

## 8. Cấu trúc

```text
src/app/
├── core/
│   ├── auth/
│   ├── guards/
│   └── supabase/
├── layout/
└── features/
    ├── auth/
    ├── dashboard/
    ├── classes/
    ├── students/
    ├── attendance/
    ├── finance/
    ├── staff/
    └── settings/

supabase/
├── migrations/
└── functions/
    ├── _shared/
    ├── health/
    ├── dashboard-summary/
    └── attendance-bulk-upsert/
```

## 9. Nguyên tắc code

- CRUD đọc đơn giản: Angular → Supabase Data API → RLS.
- Nghiệp vụ tiền/lương/đóng tháng: Angular → Edge Function → DB.
- Không hard-code role/tỷ lệ lương trong FE.
- Không dùng service-role/secret key trong browser.
- Không xóa cứng payment/payroll/audit.
- Mọi logic tài chính quan trọng phải idempotent + transaction + audit.
- Không dùng `.env`/`environment.ts` cho cấu hình Supabase frontend.

## 10. Kiểm thử và chất lượng

```bash
npm ci
npm test
npm run build
/home/daovanhung/.local/bin/deno check --no-config --node-modules-dir=auto supabase/functions/_shared/*.ts supabase/functions/*/index.ts
```

Nếu có Docker, xác thực migration bằng `npm run supabase:start`, `npm run supabase:reset` và `npm run supabase:status` trước khi dùng `npm run supabase:types`.

## 11. Roadmap ưu tiên

1. Auth + profile/role.
2. CRUD Class/Student/Enrollment.
3. Session + Attendance + Evaluation.
4. Tuition + Payment + Debt.
5. Staff + Assignment + Payroll.
6. Period close + carry-over + report.
7. Excel migration/reconciliation.
# HVC_EDU
