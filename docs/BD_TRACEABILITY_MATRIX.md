# BD traceability matrix · phạm vi tối giản

| Nhóm | Nguồn chính | Thực hiện |
|---|---|---|
| Auth/role | `auth.service.ts`, `role.guard.ts`, `profiles` | ADMIN và STAFF; Staff không có finance/master-data |
| Lớp/học sinh | `minimal.service.ts`, `admin-master-data`, RPC upsert | CRUD Admin, đọc theo assignment, deactivate giữ lịch sử |
| Lịch/buổi | `class_schedules`, `class_sessions`, `generate-class-sessions` | Lịch tuần; sinh session idempotent theo lớp/ngày/giờ |
| Điểm danh | `attendance-session.component.ts`, `attendance-bulk-upsert` | Enrollment phải thuộc lớp và hiệu lực tại ngày session |
| Nhận xét | `evaluation-session.component.ts`, `evaluation-bulk-upsert` | Một nhận xét/học sinh/buổi, audit mutation |
| Nhân sự/chấm công | `people-hub`, `staff-attendance`, RPC | Admin quản lý; Staff tự ghi bản ghi theo ngày |
| Thu chi | `finance.component.ts`, `record-financial-transaction` | INCOME/EXPENSE, số tiền integer VND, Admin-only |
| Dashboard | `home.component.ts`, `dashboard-summary` | Lớp, học sinh, staff, session; Admin có thu/chi/số dư |
| Audit | `audit_logs`, `write_audit` | Backend only, không có audit UI |
| Seed | `scripts/reset-and-seed-master-data.sql` | 4 lớp, 50 HS, 5 staff, 50 enrollment, 8 schedule, 8 assignment |

## Loại khỏi sản phẩm

Kỳ tháng, học phí, payment/công nợ, payroll, carry-over, quỹ/lợi nhuận, import Excel, báo cáo chi tiết, notification và các màn hình audit đã bị loại khỏi route, source và remote Edge Function. Các migration lịch sử cũ vẫn được giữ nguyên; migration `202609060005` dựng lại schema tối giản, `202609060006` dọn object legacy, `202609060007` siết tenant scope và `202609060008` giới hạn Dashboard Staff.
