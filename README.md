# HVC EDU · Quản lý trung tâm tối giản

Hệ thống Angular standalone + Supabase cho bốn việc chính: quản lý lớp và học sinh, lịch/buổi học, điểm danh–nhận xét, nhân sự–chấm công và sổ thu chi.

## Phạm vi

- Admin: dashboard, CRUD lớp/học sinh/nhân sự, phân công, sinh buổi theo khoảng ngày, điểm danh, nhận xét, chấm công và thu chi.
- Staff: dashboard giới hạn, lớp được phân công, roster/lịch/buổi học, điểm danh, nhận xét và tự chấm công.
- Dữ liệu tiền là `bigint` VND. Dữ liệu lịch sử được giữ; thao tác xóa master data chuyển sang `INACTIVE`.
- Không có kỳ tháng, học phí, payment/công nợ, payroll, carry-over, quỹ/lợi nhuận, import, thông báo hoặc màn hình audit.

## Chạy frontend

Yêu cầu Node.js `>= 22.22.3` và npm:

```bash
npm ci
npm start
```

Frontend dùng URL và publishable key trong `src/app/core/config/supabase.constants.ts`. Không đưa service key/secret vào Angular.

## Database và seed

Migration mới không sửa lịch sử migration cũ:

- `supabase/migrations/202609060005_minimal_system.sql`: dựng schema, RPC và RLS tối giản.
- `supabase/migrations/202609060006_remove_legacy_objects.sql`: xóa bảng/type legacy còn sót.
- `supabase/migrations/202609060007_tenant_guards.sql`: siết tenant scope cho các RPC cập nhật theo ID.
- `supabase/migrations/202609060008_dashboard_staff_scope.sql`: giới hạn số liệu nhân sự trên Dashboard Staff.
- `supabase/migrations/202609060009_root_control_plane.sql`: session Root, rate-limit và RPC quản trị tài khoản Admin.

Target seed cố định là Supabase project `ytixnjosaruvpnlvkesv`. Sau khi đã backup data-only ngoài repository, chạy:

```bash
bash scripts/reset-and-seed-master-data.sh
```

Script dùng Storage API để xóa object trong `center-imports`, giữ bucket, sau đó giữ Admin/center `HC`, xóa dữ liệu vận hành cũ và seed 4 lớp, 50 học sinh, 5 nhân sự, 50 enrollment, 8 lịch tuần và 8 phân công. Seed không tạo session, attendance, evaluation, chấm công hoặc thu chi.

Để đồng bộ an toàn từ Markdown mà không xóa dữ liệu ngoài nguồn, dùng:

```bash
bash scripts/sync-master-data.sh --dry-run
bash scripts/sync-master-data.sh
```

Sync dùng advisory lock và transaction, upsert theo mã, giữ enrollment/lịch sử/dữ liệu vận hành ngoài nguồn, không đụng Storage hoặc auth. Enrollment mới dùng ngày hiệu lực `2026-09-01`; conflict học sinh đang active ở lớp khác sẽ rollback toàn bộ.

## Edge Functions

`health`, `dashboard-summary`, `admin-master-data`, `generate-class-sessions`, `attendance-bulk-upsert`, `evaluation-bulk-upsert`, `staff-attendance`, `invite-staff-account`, `record-financial-transaction`, `root-auth`, `root-admin-accounts`.

Mutation đi theo đường `Angular → Edge Function → RPC transaction → audit_logs`; RLS giới hạn Staff theo assignment và cấm Staff đọc finance/quản lý master data.

## Root control plane

Root đăng nhập bằng username cố định `admin` qua Edge Function `root-auth`, không qua Supabase Auth ở browser. Session Root là token opaque ngắn hạn lưu trong `sessionStorage`; mật khẩu chỉ được lưu dưới dạng PBKDF2 hash trong Edge Function Secrets.

Provision secret một lần bằng terminal, không ghi mật khẩu vào repository:

```bash
bash scripts/provision-root.sh
```

Root chỉ quản lý tài khoản Admin qua `/root/admins`. Admin mới được mời bằng email qua Supabase Admin API và vẫn đăng nhập ứng dụng vận hành bằng Supabase Auth. Root không được mở quyền Data API hoặc bypass tenant isolation của dữ liệu vận hành.

## Kiểm thử

```bash
npm test
npm run build
deno check --no-config --node-modules-dir=auto supabase/functions/_shared/*.ts supabase/functions/*/index.ts
```

Local Supabase cần Docker/Podman:

```bash
supabase db reset
```

## Cấu trúc chính

```text
src/app/features/
├── auth/              # login, reset password
├── home/              # dashboard
├── education/         # hub lớp/học sinh
├── classes/           # lớp, lịch, roster, session
├── attendance/        # điểm danh, nhận xét
├── people/            # nhân sự, mời tài khoản
├── staff/             # chấm công theo ngày
├── finance/           # sổ thu chi
└── account/           # hồ sơ và mật khẩu
```
