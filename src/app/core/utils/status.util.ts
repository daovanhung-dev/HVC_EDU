const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  LOCKED: 'Đã khóa',
  NONE: 'Chưa liên kết',
  LEFT: 'Đã rời lớp',
  GRADUATED: 'Đã hoàn thành',
  OPEN: 'Đang mở',
  CLOSING: 'Đang chốt',
  CLOSED: 'Đã đóng',
  SCHEDULED: 'Đã lên lịch',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  DRAFT: 'Bản nháp',
  CONFIRMED: 'Đã xác nhận',
  PAID: 'Đã thanh toán',
  PARTIAL: 'Thanh toán một phần',
  UNPAID: 'Chưa thanh toán',
  CONFLICT: 'Có xung đột',
  PERIOD_CLOSED: 'Kỳ đã đóng',
  ENROLLMENT_REJOIN_REQUIRED: 'Cần tạo enrollment mới',
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng',
  EXCUSED: 'Có phép',
  APPROVED: 'Đã duyệt',
  IN_PROGRESS: 'Đang thực hiện',
  SUBMITTED: 'Chờ duyệt',
  REJECTED: 'Bị từ chối',
  INFO: 'Thông tin',
  WARNING: 'Cảnh báo',
  BLOCKED: 'Đang chặn',
  IMPORTED: 'Đã nhập',
  VALIDATING: 'Đang kiểm tra',
  READY: 'Sẵn sàng nhập',
  IMPORTING: 'Đang nhập',
  RECONCILED: 'Đã đối soát',
  FAILED: 'Thất bại',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  ACCOUNTANT: 'Kế toán',
  TEACHER: 'Giáo viên',
  ASSISTANT: 'Trợ giảng',
  MAIN_TEACHER: 'Giáo viên chính',
};

export function statusLabel(value: string | null | undefined): string {
  if (!value) return 'Chưa xác định';
  return STATUS_LABELS[value] ?? ROLE_LABELS[value] ?? value;
}

export function roleLabel(value: string | null | undefined): string {
  if (!value) return 'Chưa gán vai trò';
  return ROLE_LABELS[value] ?? value;
}

export function statusTone(value: string | null | undefined): 'positive' | 'warning' | 'danger' | 'neutral' {
  switch (value) {
    case 'ACTIVE':
    case 'OPEN':
    case 'COMPLETED':
    case 'PAID':
    case 'APPROVED':
    case 'INFO':
    case 'PRESENT':
    case 'READY':
    case 'IMPORTED':
    case 'RECONCILED':
      return 'positive';
    case 'CLOSING':
    case 'DRAFT':
    case 'PARTIAL':
    case 'SCHEDULED':
    case 'VALIDATING':
    case 'IMPORTING':
    case 'IN_PROGRESS':
    case 'SUBMITTED':
    case 'WARNING':
      return 'warning';
    case 'INACTIVE':
    case 'CLOSED':
    case 'CANCELLED':
    case 'ABSENT':
    case 'FAILED':
    case 'LOCKED':
    case 'UNPAID':
    case 'REJECTED':
    case 'BLOCKED':
    case 'CONFLICT':
    case 'PERIOD_CLOSED':
      return 'danger';
    default:
      return 'neutral';
  }
}
