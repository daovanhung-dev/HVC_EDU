# 05 — AI Agent Operating Rules

## 1. Luật nạp context

Trước task code không tầm thường, đọc `docs/agent-context/README.md` và các file liên quan.

Với business feature, luôn đọc Business Design đoạn tương ứng.

Với bug runtime, ưu tiên code + migration + log hiện tại hơn mô tả tiến độ cũ.

## 2. Không được làm

### Security

- Không đưa secret/service-role/DB password/access token vào Angular.
- Không log credential/token đầy đủ.
- Không tắt RLS để "fix nhanh".
- Không tin role/center do client tự khai báo nếu server có thể derive từ auth context.

### Data integrity

- Không hard-delete payment/payroll/audit/history quan trọng.
- Không sửa lịch sử enrollment bằng cách reopen row `LEFT`.
- Không dùng float cho VND.
- Không biến dữ liệu nguồn thiếu/`#REF!` thành 0 hoặc giá trị tự đoán.

### Architecture

- Không tính payroll authoritative trong FE.
- Không tính/ghi tuition tài chính phức tạp bằng browser direct write.
- Không bypass RPC transaction bằng nhiều call độc lập nếu business operation phải atomic.
- Không hard-code role/payroll ratio/business policy vào component nếu server/settings đã quản lý.

### Scope discipline

- Không refactor diện rộng ngoài task nếu không cần.
- Không đổi version major dependency chỉ để giải một bug nhỏ.
- Không sửa migration đã deploy theo kiểu rewrite history; ưu tiên migration mới.

## 3. Luật khi thêm/sửa feature

Agent phải trả lời được 7 câu trước khi hoàn tất:

1. Actor nào dùng chức năng này?
2. Route/component nào chịu trách nhiệm?
3. Dữ liệu đọc từ đâu?
4. Mutation đi qua Data API hay Edge Function/RPC? Vì sao?
5. RLS/authorization đảm bảo gì?
6. Business invariant nào có nguy cơ bị phá?
7. Test nào chứng minh thay đổi đúng?

Nếu không trả lời được, impact analysis chưa đủ.

## 4. Quy tắc tiền

- VND = integer.
- Database = `bigint` cho amount.
- UI format chỉ là presentation.
- Parse input phải validate integer VND.
- Tỷ lệ/policy có thể numeric nhưng kết quả tiền phải theo rounding rule server.
- Payroll cap/floor/step do server policy quyết định.

## 5. Quy tắc authorization

UI visibility không phải authorization.

Mỗi mutation quan trọng phải được chặn ở server/database bằng một hoặc nhiều lớp:

- JWT/auth validation;
- role/center/assignment check;
- RLS;
- RPC permission;
- revoke direct table writes.

## 6. Quy tắc audit/history

Mutation consequential phải audit, đặc biệt:

- role/profile;
- class/student/staff master thay đổi quan trọng;
- enrollment end/re-entry;
- tuition/payment/adjustment;
- payroll;
- finance;
- period close;
- import.

Nếu thêm mutation mới, kiểm tra xem audit schema/helper hiện tại có thể reuse hay không.

## 7. Quy tắc idempotency

Các mutation có nguy cơ user retry/network retry tạo duplicate phải kiểm tra idempotency strategy hiện tại.

Đặc biệt chú ý:

- payment;
- generate tuition;
- carry-over;
- payroll;
- close period;
- import.

Không thêm idempotency key ở FE mà server không enforce.

## 8. Quy tắc UI

Mỗi màn dữ liệu phải xử lý hợp lý:

- loading;
- error;
- empty;
- disabled/pending action;
- validation;
- permission visibility;
- responsive state theo pattern dự án.

Không hiển thị raw Supabase error cho người dùng nếu đã có error mapping.

## 9. Quy tắc test

### FE utility/business presentation

Thêm unit test khi logic có nhánh/công thức/parse/format/error mapping.

### Backend

Test/verify:

- success path;
- unauthorized/forbidden;
- invalid input;
- duplicate/idempotent retry khi liên quan;
- history preservation;
- transaction rollback khi có multi-write.

### Regression

Bugfix phải có regression evidence tối thiểu bằng test hoặc reproducible verification.

## 10. Quy tắc cập nhật tài liệu

Nếu thay đổi:

- business behavior;
- route/module;
- API contract;
- security model;
- deployment workflow;
- critical invariant;

thì cập nhật file context/BD/traceability/implementation note phù hợp trong cùng change set.

## 11. Output mong muốn từ Agent sau task

Agent nên báo cáo ngắn theo format:

```text
Changed:
- ...

Business/Architecture impact:
- ...

Validation:
- npm test: PASS/FAIL
- npm run build: PASS/FAIL
- Deno/Supabase checks: PASS/FAIL/NOT RUN + reason

Remaining risk:
- ...
```

Không tuyên bố "100% hoàn thành" nếu còn runtime test/credential/deploy chưa xác minh.
