# 03 — Functional Modules

## 1. Mục tiêu nghiệp vụ

Hệ thống chuyển mô hình vận hành từ Excel sang Web App nhưng phải giữ nguyên logic nghiệp vụ quan trọng, đồng thời chuẩn hóa dữ liệu, phân quyền, transaction và audit.

Workbook nguồn có 41 sheet và hoạt động như một ERP mini của trung tâm.

## 2. Actor và quyền

### ADMIN / OWNER

Toàn quyền:

- lớp/học sinh/nhân sự;
- phân công;
- attendance/evaluation;
- học phí/payment;
- finance;
- payroll;
- kỳ kế toán;
- settings;
- role/account;
- audit/import.

### ACCOUNTANT

Tập trung nghiệp vụ tài chính:

- xem lớp/học sinh/nhân sự cần thiết;
- học phí;
- payment/công nợ;
- thu/chi;
- payroll preview/xử lý theo quyền;
- report tài chính;
- period preview.

Không có quyền admin settings/audit/role mutation nếu policy không cho phép.

### TEACHER

- xem lớp được phân công;
- xem roster/lịch;
- điểm danh;
- đánh giá học sinh;
- báo cáo học tập trong phạm vi quyền.

Không truy cập finance.

### ASSISTANT

Tương tự teaching scope theo assignment:

- xem lớp được phân công;
- điểm danh;
- đánh giá theo quyền;
- không finance.

## 3. Module chức năng

### A. Authentication & Profile

Chức năng:

- login;
- reset password;
- load session/profile;
- resolve role/center;
- guard route;
- invite/link staff account;
- cập nhật role bằng luồng server-side được audit.

Invariant: frontend không tự quyết định quyền chỉ dựa vào UI visibility.

### B. Dashboard

Hiển thị KPI tổng quan theo center/period:

- lớp;
- học sinh;
- học phí/doanh thu/công nợ;
- payroll/chi phí;
- quỹ/lợi nhuận;
- cảnh báo integrity khi có.

Ưu tiên dùng server summary thay vì N query rời rạc nếu function hiện tại đã hỗ trợ.

### C. Classes & Schedules

- CRUD class master theo quyền;
- mã lớp, tên, khối, môn, học phí chuẩn;
- active/inactive;
- lịch tuần;
- sinh session tháng;
- xem detail/roster/assignment.

Không sửa ledger lịch sử khi thay học phí chuẩn của lớp.

### D. Students & Enrollments

- student master;
- enrollment vào lớp;
- enrollment history;
- kết thúc enrollment với end date;
- re-entry tạo enrollment mới.

Invariant:

- enrollment `LEFT` là terminal;
- không reopen row lịch sử;
- re-entry phải tạo row mới;
- deactivation phải giữ lịch sử.

### E. Attendance

Theo từng `class_session`:

- roster của enrollment hợp lệ;
- trạng thái điểm danh;
- bulk upsert;
- kiểm soát quyền theo assignment/role.

Dữ liệu nguồn sử dụng C/N và có ô trống; import không được tự bịa trạng thái cho ô không có dữ liệu.

### F. Evaluations

Theo session/student:

- điểm BTVN;
- mức hiểu bài;
- thái độ học tập;
- lỗ hổng/ghi chú;
- nhận xét buổi học.

Bulk mutation đi qua server path hiện tại nếu đã được thiết kế.

### G. Tuition

- preview học phí;
- generate ledger theo period/class/enrollment;
- đơn giá lớp + `unit_price_override` nếu có;
- adjustment;
- giảm trừ/carry-over;
- tổng phải thu/đã thu/công nợ.

Invariant:

- confirmed/paid ledger không bị overwrite tùy tiện;
- tiền integer VND;
- mọi thay đổi quan trọng phải trace/audit.

### H. Payments & Debt

- record payment;
- void payment thay vì delete;
- recalculation ledger từ payment còn hiệu lực;
- debt list;
- carry-over giữa kỳ.

Invariant:

- chặn overpayment bằng business validation;
- void không làm mất lịch sử;
- carry-over phải có source linkage/idempotency.

### I. Staff & Assignments

- teacher/assistant master;
- email/account status;
- class assignment;
- role/link account;
- inactive handling.

Staff account invite chỉ dành cho quyền admin theo implementation hiện tại.

### J. Payroll

- tính payroll server-side;
- policy có thể cấu hình;
- doanh thu lớp;
- rate;
- base;
- bonus;
- penalty;
- final amount;
- draft/approve.

Invariant:

- Angular KHÔNG tự tính payroll authoritative;
- server áp cap/rounding/policy;
- approved payroll không bị overwrite bởi recalculation;
- teaching role không được lộ số tiền nếu policy không cho phép.

### K. Financial Transactions

Quản lý thu/chi ngoài học phí:

- date;
- type;
- category;
- description;
- amount.

Không tạo transaction thiếu metadata chỉ vì workbook cũ thiếu; import phải ghi warning/fallback rõ ràng theo quyết định hiện hành.

### L. Student Rewards

Ghi nhận thưởng học sinh theo period/center và phản ánh vào reporting/finance theo mô hình hiện tại.

### M. Fund & Profit

- fund ledger;
- tỷ lệ trích quỹ;
- profit distribution;
- snapshot theo kỳ;
- audit.

Không tính authoritative ở component nếu server/RPC đã có logic.

### N. Accounting Periods

- tạo/chọn kỳ;
- context kỳ hiện tại;
- preview close;
- close period;
- carry outstanding debt sang kỳ tiếp theo khi có;
- khóa/giữ lịch sử theo business rule.

Đây là workflow nhạy cảm cao. Mọi thay đổi cần kiểm tra tuition + payment + payroll + finance + carry-over cùng lúc.

### O. Reports

- báo cáo lớp;
- báo cáo học sinh;
- KPI theo period;
- role-aware data visibility.

### P. Settings

Cấu hình policy thay vì hard-code ở FE, đặc biệt:

- payroll policy;
- finance/fund rules;
- center configuration;
- permission-related settings nếu có.

### Q. Audit

Ghi lại mutation quan trọng:

- actor;
- entity/action;
- before/after khi phù hợp;
- timestamp;
- trace/source metadata.

### R. Migration / Excel Import

- upload workbook vào private storage;
- validate server-side;
- import normalize;
- lưu import job/issues;
- integrity check;
- reconciliation.

Không convert `#REF!` thành 0. Không bịa dữ liệu còn thiếu.

## 4. Snapshot nghiệp vụ tháng 08/2026

Dữ liệu nguồn chính:

- lớp hoạt động: L06, L07, L08, L09;
- roster: 50 học sinh;
- accounting rows: 48 học sinh;
- staff có mã: 5;
- tổng phải thu/đã thu: 14.485.000 VND;
- payroll workbook: 5.794.000 VND;
- chi phí khác: 6.270.898 VND;
- fund contribution: khoảng 242.010 VND;
- distributable profit: khoảng 2.178.092 VND.

Các mismatch nguồn phải được giữ dưới dạng cảnh báo, không được "sửa" bằng suy đoán.
