# Implementation notes · HVC EDU tối giản

## Kiến trúc hiện tại

Frontend giữ các route vận hành `/dashboard`, `/classes`, `/classes/:id`, các route session attendance/evaluation, `/staff`, `/staff/attendance`, `/finance`, `/account`, `/login` và `/reset-password`, cùng control-plane Root `/root/admins`.

Backend giữ `centers`, `profiles`, `audit_logs` và 11 bảng vận hành: `staff`, `classes`, `class_schedules`, `students`, `enrollments`, `class_assignments`, `class_sessions`, `attendance`, `student_evaluations`, `staff_attendance`, `financial_transactions`.

Các mutation quan trọng đều đi qua RPC `SECURITY DEFINER`, kiểm tra role/tenant/assignment, ghi `audit_logs` và trả response envelope từ Edge Function. Sinh session idempotent nhờ unique slot `(class_id, session_date, start_time)`.

## Quy tắc quyền

- `ADMIN`: toàn quyền trong center, bao gồm nhân sự, master data, sinh session và thu chi.
- `STAFF`: chỉ đọc lớp có assignment còn hiệu lực, thao tác attendance/evaluation của lớp đó và tự ghi chấm công.
- Finance chỉ có policy đọc cho Admin; không có grant ghi trực tiếp từ trình duyệt.
- Tài khoản Staff được tạo bằng `invite-staff-account`; không có shared account.
- Root `admin` là control-plane account riêng: login qua `root-auth`, session qua `root_sessions`, không có `auth.users`/`profiles` và không đọc dữ liệu vận hành trực tiếp.
- Root tạo/khóa Admin qua `root-admin-accounts`; Admin mới vẫn dùng Supabase Auth, profile `ADMIN`, audit actor là `actor_login = 'admin'`.

## Master data

Nguồn seed là `docs/fill_data/Nguon_Data_Van_Hanh_TrungTam_HungCuong.md`. Kết quả remote đã xác nhận: L06/L07/L08/L09 có lần lượt 18/13/7/12 học sinh; không tạo dữ liệu tháng hoặc tài chính.

## Vận hành reset

`scripts/reset-and-seed-master-data.sh` kiểm tra đúng project, gọi Storage API cho bucket `center-imports`, sau đó chạy SQL trong một transaction. SQL giữ các profile ADMIN và center `HC`, xóa auth user non-admin, seed master data và ghi hai audit record mới. Bản backup tạm không nằm trong repository.

## Đồng bộ Master Data an toàn

`scripts/sync-master-data.sh` là luồng không phá dữ liệu cho nguồn Markdown. Chạy `--dry-run` trước, sau đó chạy không tham số để commit. Script kiểm tra đúng project/center/Admin, khóa advisory, upsert theo mã và ghi một audit `MASTER_DATA_SYNC`. Nó không xóa dữ liệu ngoài nguồn, không thay đổi auth, Storage, session, attendance, evaluation, chấm công hoặc finance; conflict enrollment active khác lớp sẽ làm transaction rollback.

## Khôi phục session frontend

Các truy vấn đọc qua `MinimalService` nhận diện lỗi JWT/401, refresh access token một lần và tạo lại query để retry. Nếu refresh thất bại, `AuthService` xóa session local và đưa người dùng về `/login?reason=session-expired`; lỗi 403 không retry và được hiển thị như lỗi quyền.

## Xác nhận remote ngày 2026-09-06

- Migration `202609060005` đến `202609060008` đã áp dụng.
- Remote chỉ còn 9 Edge Function tối giản.
- `admins=1`, `profiles=1`, `hc_centers=1`, `classes=4`, `students=50`, `enrollments=50`, `staff=5`, `schedules=8`, `assignments=8`.
- `sessions=0`, `attendance=0`, `evaluations=0`, `staff_attendance=0`, `finance=0`.
- Bucket `center-imports` tồn tại, private và không có object.

## Root control plane source

- Migration `202609060009_root_control_plane.sql` tạo `root_sessions`, `root_login_attempts`, cột audit `actor_login` và RPC service-role cho tạo/khóa Admin.
- Edge Functions `root-auth` và `root-admin-accounts` đều tắt Supabase JWT verification, nhưng tự kiểm tra Root session trước mọi thao tác quản trị.
- `scripts/provision-root.sh` sinh PBKDF2 hash từ mật khẩu nhập ẩn và set secret; không chứa credential thật.
- Remote project `ytixnjosaruvpnlvkesv` đã áp dụng migration `202609060009` và deploy hai function Root; cần chạy provision secret trước khi đăng nhập Root lần đầu.
