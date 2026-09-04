# 02 — Technology Stack

## 1. Frontend

### Angular

- Angular: `22.x`.
- Standalone components.
- Angular Router với lazy `loadComponent`.
- Forms: Angular Forms/Reactive Forms theo implementation hiện tại.
- RxJS: `~7.8.x`.
- TypeScript: `~6.0.x`.
- Unit test runner: Vitest qua Angular build tooling.

### Runtime/build

- Node.js yêu cầu: `>= 22.22.3`.
- Package manager chuẩn: npm.
- Cài dependency reproducible bằng `npm ci`.

Không tự ý đổi major Angular/TypeScript/Supabase nếu task không yêu cầu.

## 2. Backend platform — Supabase

Dự án sử dụng Supabase như backend platform gồm:

### Supabase Auth

- đăng nhập người dùng;
- JWT/session;
- liên kết Auth user với `profiles`/staff account;
- role lấy từ profile/context của hệ thống, không tin role do browser tự gửi.

### PostgreSQL

Là source of truth dữ liệu nghiệp vụ.

Nguyên tắc:

- tiền lưu integer VND, Postgres `bigint`;
- tỷ lệ/policy dùng `numeric`;
- không dùng floating point cho tiền;
- lịch sử tài chính không hard-delete;
- mutation quan trọng có audit;
- transaction nhiều bước dùng RPC.

### Data API

Dùng cho read và CRUD đơn giản khi RLS mô tả được quyền an toàn.

Không dùng Data API direct browser write để bypass RPC của các entity đã bị revoke quyền mutation trực tiếp.

### Row Level Security

RLS là một phần của authorization, không phải lớp bảo vệ phụ.

Tenant isolation dựa trên `center_id` và assignment/role context.

Teacher/Assistant chỉ được truy cập phạm vi lớp được phân công theo policy hiện hành.

### Edge Functions

- TypeScript/Deno.
- Là API layer cho nghiệp vụ quan trọng.
- Nhận JWT/auth context.
- Validate input.
- Gọi RPC transaction.
- Chuẩn hóa response/error + `traceId`.
- Mutation quan trọng hỗ trợ `x-idempotency-key` khi thiết kế yêu cầu.

## 3. Frontend Supabase configuration

Frontend đọc cấu hình public tại:

`src/app/core/config/supabase.constants.ts`

Chỉ được chứa:

- project URL;
- publishable/public key.

Tuyệt đối không đưa vào browser:

- service-role key;
- Supabase secret key;
- database password;
- GitHub/Supabase access token;
- bất kỳ credential server-side nào.

Project cố ý không dùng `.env`/`environment.ts` cho runtime Supabase frontend.

## 4. Database/API contract

`src/app/core/supabase/database.types.ts` hiện là compile-time contract tối thiểu trong trường hợp không generate được từ local Supabase.

Không giả định file này luôn phản ánh 100% remote schema. Nếu task phụ thuộc schema cụ thể, kiểm tra migration trước.

Generate types khi local stack khả dụng:

```bash
npm run supabase:types
```

## 5. Local development

Frontend:

```bash
npm ci
npm start
```

Angular mặc định:

```text
http://localhost:4200
```

Supabase local cần Docker/Podman:

```bash
npx supabase start
npx supabase db reset
npx supabase status
npx supabase functions serve
```

## 6. Quality gates

Bắt buộc tối thiểu trước khi coi task code hoàn tất:

```bash
npm ci
npm test
npm run build
```

Edge Functions:

```bash
deno check --no-config --node-modules-dir=auto \
  supabase/functions/_shared/*.ts \
  supabase/functions/*/index.ts
```

Khi Docker/Supabase local khả dụng, bổ sung migration reset/lint/smoke test.

## 7. Deployment technology

### Frontend

GitHub Actions → Angular production build → GitHub Pages.

Repo project page dùng base href:

```text
/HVC_EDU/
```

Workflow tạo `404.html` từ `index.html` để hỗ trợ SPA fallback trên GitHub Pages.

### Backend

GitHub Actions → Supabase CLI:

1. link project;
2. push project config;
3. `db push` migrations;
4. deploy Edge Functions;
5. list deployed functions.

Credential CI phải nằm trong GitHub Secrets/Variables, không commit vào repository.
