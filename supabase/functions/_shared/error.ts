import { fail, withCors } from './response.ts';

const messages: Record<string, string> = {
  UNAUTHENTICATED: 'Vui lòng đăng nhập',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này',
  VALIDATION_ERROR: 'Dữ liệu gửi lên không hợp lệ',
  CLASS_NOT_FOUND: 'Không tìm thấy lớp học',
  SESSION_NOT_FOUND: 'Không tìm thấy buổi học',
  PERIOD_NOT_FOUND: 'Không tìm thấy kỳ kế toán',
  PERIOD_NOT_OPEN: 'Kỳ kế toán chưa mở hoặc đã đóng',
  PERIOD_CLOSED: 'Kỳ kế toán đã đóng',
  CLASS_NOT_ASSIGNED: 'Bạn chưa được phân công lớp này',
  ENROLLMENT_NOT_ACTIVE: 'Học sinh không thuộc lớp tại ngày này',
  LEDGER_NOT_FOUND: 'Không tìm thấy sổ học phí',
  PAYMENT_EXCEEDS_DEBT: 'Số tiền thu vượt công nợ còn lại',
  PAYMENT_ALREADY_VOIDED: 'Khoản thu đã được void',
  PAYMENT_NOT_FOUND: 'Không tìm thấy khoản thu',
  PAYROLL_POLICY_NOT_FOUND: 'Chưa cấu hình chính sách lương cho kỳ này',
  PAYROLL_CAP_EXCEEDED: 'Tổng lương vượt trần chính sách',
  STAFF_NOT_FOUND: 'Không tìm thấy nhân sự',
  STUDENT_NOT_FOUND: 'Không tìm thấy học sinh',
  ENROLLMENT_NOT_FOUND: 'Không tìm thấy enrollment',
  PAYROLL_NOT_FOUND: 'Không tìm thấy bảng lương',
  PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ người dùng trong trung tâm',
  IMPORT_VALIDATION_FAILED: 'Dữ liệu import chưa hợp lệ',
  IDEMPOTENCY_IN_PROGRESS: 'Yêu cầu trùng đang được xử lý, hãy thử lại sau',
  PAYROLL_ALREADY_APPROVED: 'Bảng lương đã được duyệt và bị khóa',
  CLOSE_PERIOD_BLOCKED: 'Kỳ còn dữ liệu chưa hoàn tất',
  VERSION_CONFLICT: 'Dữ liệu đã thay đổi, hãy tải lại trang',
  NOT_FOUND: 'Không tìm thấy dữ liệu',
  INTERNAL_ERROR: 'Không thể hoàn tất thao tác',
};

export function errorResponse(error: unknown, request: Request, traceId: string): Response {
  const raw = error instanceof Error ? error.message : String(error ?? 'INTERNAL_ERROR');
  const pgCode = typeof error === 'object' && error !== null ? String((error as { code?: unknown }).code ?? '') : '';
  const code = raw.includes('PAYMENT_EXCEEDS_DEBT') ? 'PAYMENT_EXCEEDS_DEBT' :
    pgCode === '23505' || raw.includes('duplicate key') ? 'CONFLICT' :
    pgCode === '23514' || raw.includes('check constraint') ? 'VALIDATION_ERROR' :
    raw.includes('already exists') ? 'CONFLICT' :
    Object.keys(messages).find((key) => raw.includes(key)) ?? 'INTERNAL_ERROR';
  const status = code === 'UNAUTHENTICATED' ? 401 : code === 'FORBIDDEN' || code === 'CLASS_NOT_ASSIGNED' ? 403 :
    ['NOT_FOUND','CLASS_NOT_FOUND','SESSION_NOT_FOUND','PERIOD_NOT_FOUND','LEDGER_NOT_FOUND','PAYMENT_NOT_FOUND','STAFF_NOT_FOUND','STUDENT_NOT_FOUND','ENROLLMENT_NOT_FOUND','PAYROLL_NOT_FOUND','PAYROLL_POLICY_NOT_FOUND','PROFILE_NOT_FOUND'].includes(code) ? 404 :
    ['PERIOD_CLOSED','PERIOD_NOT_OPEN','PAYMENT_EXCEEDS_DEBT','PAYMENT_ALREADY_VOIDED','PAYROLL_ALREADY_APPROVED','PAYROLL_CAP_EXCEEDED','VERSION_CONFLICT','CONFLICT','CLOSE_PERIOD_BLOCKED','IMPORT_VALIDATION_FAILED','IDEMPOTENCY_IN_PROGRESS'].includes(code) ? 409 : 400;
  return withCors(fail(status, code, messages[code] ?? messages['INTERNAL_ERROR'], null, traceId), request);
}
