# Implementation progress · HVC EDU tối giản

## Trạng thái

Kế hoạch viết lại hệ thống tối giản đã được triển khai trong worktree và remote Supabase project `ytixnjosaruvpnlvkesv`.

## Đã hoàn tất

- Thay route/navigation/shell cũ bằng Dashboard, Lớp học, Nhân sự, Chấm công, Thu chi và Tài khoản.
- Viết lại Angular service/component theo schema tối giản; bỏ PeriodContext, month setup, tuition, payment, debt, payroll, carry-over, fund/profit, import, notification và audit UI.
- Thêm CRUD Admin cho staff/class/student, enrollment lịch sử, schedule, assignment và soft-deactivate.
- Thêm sinh session theo lịch tuần, điểm danh, nhận xét theo session và chấm công staff theo ngày.
- Thêm sổ giao dịch INCOME/EXPENSE, tổng doanh thu, tổng chi và số dư.
- Thêm migration schema/RLS/RPC, Edge Functions, seed/reset có backup và audit.
- Regenerate `database.types.ts` từ schema remote.
- Gỡ Edge Function legacy khỏi remote và source local.

## Kiểm thử đã chạy

- `npm test`: PASS, 6 test files / 13 tests.
- `npm run build`: PASS.
- `deno check --no-config --node-modules-dir=auto supabase/functions/_shared/*.ts supabase/functions/*/index.ts`: PASS.
- Remote smoke: Dashboard RPC và sinh session gọi hai lần trong cùng transaction cho kết quả 16 rồi 0, transaction rollback.
- `git diff --check`: PASS sau khi hoàn tất chỉnh sửa.

## Giới hạn môi trường

`supabase db reset` local cần Docker/Podman, hiện máy không có runtime này. Các migration `202609060005`–`202609060008` và reset/seed remote đã chạy bằng Supabase CLI; workflow Supabase vẫn chạy `npm ci`, validate cấu hình và deploy.
