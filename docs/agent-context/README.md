# HVC_EDU — AI Agent Context

> Mục đích: giúp AI Agent/Codex/GPT Luna nạp đúng context dự án trước khi phân tích, sửa code hoặc triển khai chức năng.
> Snapshot context: 04/09/2026.

## 1. Thứ tự đọc bắt buộc

Agent phải đọc theo thứ tự sau trước khi thực hiện task có ảnh hưởng tới code hoặc nghiệp vụ:

1. `AGENTS.md` — luật kiến trúc và chất lượng ở cấp repository.
2. `docs/agent-context/01_PROJECT_STRUCTURE.md` — cấu trúc source và trách nhiệm từng vùng.
3. `docs/agent-context/02_TECH_STACK.md` — công nghệ, runtime, ranh giới FE/BE.
4. `docs/agent-context/03_FUNCTIONAL_MODULES.md` — chức năng, actor, module và luồng nghiệp vụ.
5. `docs/agent-context/04_PROJECT_WORKFLOW.md` — workflow phát triển, deploy và workflow nghiệp vụ.
6. `docs/agent-context/05_AGENT_OPERATING_RULES.md` — nguyên tắc bắt buộc khi agent thay đổi hệ thống.
7. `docs/agent-context/06_CURRENT_STATE.md` — trạng thái implementation/deploy tại thời điểm context được tạo.
8. `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md` — Business Design, nguồn sự thật nghiệp vụ.
9. `docs/BD_TRACEABILITY_MATRIX.md` — mapping yêu cầu ↔ implementation/test.
10. `docs/tasks/PLAN_GPT_LUNA_FULL_SYSTEM.md` — kế hoạch triển khai nguồn.

Nếu context rút gọn mâu thuẫn với BD hoặc code đang chạy, ưu tiên:

`Business Design + business invariants` → `migration/RPC/Edge Function hiện tại` → `Angular implementation` → `agent-context` → `README`.

## 2. Tóm tắt dự án trong 30 giây

HVC_EDU là Web App quản lý Trung tâm Hùng Cường, thay thế workbook Excel 41 sheet bằng hệ thống chuẩn hóa gồm:

- quản lý lớp và lịch học;
- học sinh và enrollment;
- điểm danh;
- đánh giá học tập/BTVN/mức hiểu bài/thái độ/nhận xét;
- học phí, giảm trừ, payment, công nợ, carry-over;
- nhân sự, phân công và tài khoản;
- tính lương;
- thu/chi;
- thưởng học sinh;
- quỹ và lợi nhuận;
- kỳ kế toán/tháng;
- dashboard, báo cáo và audit;
- import/reconcile dữ liệu Excel cũ.

Stack chính:

`Angular 22 SPA` → `Supabase Auth/Data API/Edge Functions` → `PostgreSQL + RLS + RPC`.

Frontend deploy bằng GitHub Pages. Supabase deploy bằng GitHub Actions/Supabase CLI.

## 3. Mental model bắt buộc

Không xem Supabase chỉ là database. Backend của dự án gồm ba lớp:

1. **Data API + RLS**: chủ yếu cho read và thao tác đơn giản an toàn.
2. **Edge Functions**: API nghiệp vụ, auth context, validation, idempotency và response envelope.
3. **PostgreSQL RPC/transaction**: mutation nhiều bước cần atomicity/audit.

Các nghiệp vụ tiền, payroll, đóng kỳ, role/account, import hoặc mutation có side effect KHÔNG được chuyển thành browser write trực tiếp chỉ để code ngắn hơn.

## 4. Nguồn sự thật

| Mục đích | File/thư mục |
|---|---|
| Business Design | `docs/BD_HeThong_QuanLy_TrungTam_HungCuong.md` |
| Traceability | `docs/BD_TRACEABILITY_MATRIX.md` |
| Kế hoạch full system | `docs/tasks/PLAN_GPT_LUNA_FULL_SYSTEM.md` |
| Implementation status | `docs/IMPLEMENTATION_PROGRESS.md` |
| Technical decisions/gaps | `docs/IMPLEMENTATION_NOTES.md` |
| SQL test strategy | `docs/SQL_TEST_PLAN.md` |
| Angular routes | `src/app/app.routes.ts` |
| Frontend Supabase public config | `src/app/core/config/supabase.constants.ts` |
| DB schema/RPC/RLS | `supabase/migrations/` |
| Server APIs | `supabase/functions/` |
| Pages CI/CD | `.github/workflows/deploy-pages.yml` |
| Supabase CI/CD | `.github/workflows/deploy-supabase.yml` |

## 5. Khi nhận task mới

Xác định task thuộc một hoặc nhiều nhóm:

- UI/UX Angular;
- auth/role/RLS;
- master data;
- attendance/evaluation;
- tuition/payment/debt;
- payroll;
- finance/fund/profit;
- period close/carry-over;
- report/dashboard;
- import/migration;
- deployment/CI;
- bugfix/data integrity.

Sau đó trace từ `route/component → service/API → Edge Function/RPC → tables/RLS → tests` trước khi sửa.

Không sửa một lớp đơn lẻ nếu business flow đi xuyên nhiều lớp.
