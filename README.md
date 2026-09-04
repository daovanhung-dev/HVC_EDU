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

Lấy `API URL` và **publishable key** từ `npx supabase status`, sau đó:

```bash
export SUPABASE_URL='http://127.0.0.1:54321'
export SUPABASE_PUBLISHABLE_KEY='PASTE_PUBLISHABLE_KEY'
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

Các function init đã có:

- `health`
- `dashboard-summary`
- `attendance-bulk-upsert`

Các nghiệp vụ tài chính còn lại nên tiếp tục theo BD và bắt buộc đi qua Edge Function/DB transaction.

## 5. Generate DB types

Sau khi migration ổn định:

```bash
npm run supabase:types
```

> `database.types.ts` đang được `.gitignore` để tránh commit file cũ nếu schema thay đổi liên tục. Khi project ổn định có thể bỏ ignore và commit type generated.

## 6. Deploy GitHub Pages

Repository Settings → Pages → Source = **GitHub Actions**.

Tạo GitHub Repository Variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Publishable key được phép xuất hiện ở browser; **không đặt secret/service key vào Angular**.

Push `main` sẽ chạy `.github/workflows/deploy-pages.yml`.

Workflow tự:

1. Build Angular với `base-href /<repo>/`.
2. Tạo `404.html` fallback cho SPA route.
3. Deploy Pages.

Nếu dùng custom domain ở root, đổi `--base-href` thành `/`.

## 7. Deploy Supabase

Tạo GitHub variables/secrets:

Variables:
- `SUPABASE_PROJECT_REF`

Secrets:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`

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
- Không dùng `service_role`/secret key trong browser.
- Không xóa cứng payment/payroll/audit.
- Mọi logic tài chính quan trọng phải idempotent + transaction + audit.

## 10. Roadmap ưu tiên

1. Auth + profile/role.
2. CRUD Class/Student/Enrollment.
3. Session + Attendance + Evaluation.
4. Tuition + Payment + Debt.
5. Staff + Assignment + Payroll.
6. Period close + carry-over + report.
7. Excel migration/reconciliation.
# HVC_EDU
