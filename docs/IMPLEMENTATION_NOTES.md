# Implementation notes · HVC EDU tối giản

## Kiến trúc hiện tại

Frontend chỉ giữ các route `/dashboard`, `/classes`, `/classes/:id`, các route session attendance/evaluation, `/staff`, `/staff/attendance`, `/finance`, `/account`, `/login` và `/reset-password`.

Backend giữ `centers`, `profiles`, `audit_logs` và 11 bảng vận hành: `staff`, `classes`, `class_schedules`, `students`, `enrollments`, `class_assignments`, `class_sessions`, `attendance`, `student_evaluations`, `staff_attendance`, `financial_transactions`.

Các mutation quan trọng đều đi qua RPC `SECURITY DEFINER`, kiểm tra role/tenant/assignment, ghi `audit_logs` và trả response envelope từ Edge Function. Sinh session idempotent nhờ unique slot `(class_id, session_date, start_time)`.

## Quy tắc quyền

- `ADMIN`: toàn quyền trong center, bao gồm nhân sự, master data, sinh session và thu chi.
- `STAFF`: chỉ đọc lớp có assignment còn hiệu lực, thao tác attendance/evaluation của lớp đó và tự ghi chấm công.
- Finance chỉ có policy đọc cho Admin; không có grant ghi trực tiếp từ trình duyệt.
- Tài khoản Staff được tạo bằng `invite-staff-account`; không có shared account.

## Master data

Nguồn seed là `docs/fill_data/Nguon_Data_Van_Hanh_TrungTam_HungCuong.md`. Kết quả remote đã xác nhận: L06/L07/L08/L09 có lần lượt 18/13/7/12 học sinh; không tạo dữ liệu tháng hoặc tài chính.

## Vận hành reset

`scripts/reset-and-seed-master-data.sh` kiểm tra đúng project, gọi Storage API cho bucket `center-imports`, sau đó chạy SQL trong một transaction. SQL giữ các profile ADMIN và center `HC`, xóa auth user non-admin, seed master data và ghi hai audit record mới. Bản backup tạm không nằm trong repository.

## Xác nhận remote ngày 2026-09-06

- Migration `202609060005` đến `202609060008` đã áp dụng.
- Remote chỉ còn 9 Edge Function tối giản.
- `admins=1`, `profiles=1`, `hc_centers=1`, `classes=4`, `students=50`, `enrollments=50`, `staff=5`, `schedules=8`, `assignments=8`.
- `sessions=0`, `attendance=0`, `evaluations=0`, `staff_attendance=0`, `finance=0`.
- Bucket `center-imports` tồn tại, private và không có object.
