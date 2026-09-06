import { fail, withCors } from './response.ts';

const messages: Record<string, string> = {
  UNAUTHENTICATED: 'Vui lòng đăng nhập',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
  VALIDATION_ERROR: 'Dữ liệu gửi lên không hợp lệ',
  CONFLICT: 'Dữ liệu đã tồn tại hoặc bị trùng',
  CLASS_NOT_FOUND: 'Không tìm thấy lớp học',
  CLASS_NOT_ASSIGNED: 'Bạn chưa được phân công lớp này',
  SESSION_NOT_FOUND: 'Không tìm thấy buổi học',
  STUDENT_NOT_FOUND: 'Không tìm thấy học sinh',
  STAFF_NOT_FOUND: 'Không tìm thấy nhân sự',
  STAFF_INACTIVE: 'Nhân sự đang ngừng hoạt động',
  STAFF_ACCOUNT_EXISTS: 'Nhân sự đã có tài khoản hoặc tài khoản đã được liên kết',
  STAFF_ACCOUNT_INVITE_FAILED: 'Không thể gửi lời mời tài khoản Staff',
  EMAIL_INVALID: 'Email không hợp lệ',
  ADMIN_ACCOUNT_INVITE_FAILED: 'Không thể gửi lời mời tài khoản Admin',
  ASSIGNMENT_NOT_FOUND: 'Không tìm thấy phân công',
  SCHEDULE_NOT_FOUND: 'Không tìm thấy lịch học',
  ENROLLMENT_NOT_FOUND: 'Không tìm thấy enrollment',
  ENROLLMENT_NOT_ACTIVE: 'Học sinh không thuộc lớp tại ngày này',
  ENROLLMENT_MOVE_CREATE_NEW: 'Chuyển lớp phải tạo enrollment mới',
  SESSION_CANCELLED: 'Buổi học đã bị hủy',
  IDEMPOTENCY_IN_PROGRESS: 'Yêu cầu trùng đang được xử lý, hãy thử lại sau',
  NOT_FOUND: 'Không tìm thấy dữ liệu',
  INTERNAL_ERROR: 'Không thể hoàn tất thao tác',
  ROOT_INVALID_CREDENTIALS: 'Tên tài khoản hoặc mật khẩu không đúng',
  ROOT_RATE_LIMITED: 'Tài khoản Root đang bị tạm khóa do đăng nhập sai quá nhiều lần',
  ROOT_UNAUTHENTICATED: 'Phiên Root không hợp lệ hoặc đã hết hạn',
  ROOT_BACKEND_NOT_CONFIGURED: 'Hệ thống Root chưa được cấu hình đầy đủ',
  ADMIN_AUTH_USER_NOT_FOUND: 'Không tìm thấy tài khoản Auth của Admin',
  ADMIN_ACCOUNT_EXISTS: 'Tài khoản Admin đã tồn tại',
  ADMIN_NOT_FOUND: 'Không tìm thấy tài khoản Admin',
  CENTER_NOT_FOUND: 'Không tìm thấy center hoạt động',
};

const notFoundCodes = new Set([
  'CLASS_NOT_FOUND', 'SESSION_NOT_FOUND', 'STUDENT_NOT_FOUND', 'STAFF_NOT_FOUND',
  'ASSIGNMENT_NOT_FOUND', 'SCHEDULE_NOT_FOUND', 'ENROLLMENT_NOT_FOUND', 'NOT_FOUND',
]);

const conflictCodes = new Set(['CONFLICT', 'STAFF_ACCOUNT_EXISTS', 'IDEMPOTENCY_IN_PROGRESS', 'ADMIN_ACCOUNT_EXISTS']);

export function errorResponse(error: unknown, request: Request, traceId: string): Response {
  const raw = error instanceof Error ? error.message : String(error ?? 'INTERNAL_ERROR');
  const pgCode = typeof error === 'object' && error !== null ? String((error as { code?: unknown }).code ?? '') : '';
  const knownCode = Object.keys(messages).sort((left, right) => right.length - left.length).find((key) => raw.includes(key));
  const code = pgCode === '23505' || raw.includes('duplicate key') ? 'CONFLICT' :
    pgCode === '23514' || raw.includes('check constraint') ? 'VALIDATION_ERROR' :
    knownCode ?? 'INTERNAL_ERROR';
  const status = code === 'UNAUTHENTICATED' || code === 'ROOT_UNAUTHENTICATED' || code === 'ROOT_INVALID_CREDENTIALS' ? 401 : code === 'ROOT_RATE_LIMITED' ? 429 : code === 'ROOT_BACKEND_NOT_CONFIGURED' ? 500 : code === 'FORBIDDEN' || code === 'CLASS_NOT_ASSIGNED' ? 403 :
    notFoundCodes.has(code) ? 404 : conflictCodes.has(code) ? 409 : 400;
  return withCors(fail(status, code, messages[code] ?? messages.INTERNAL_ERROR, null, traceId), request);
}
