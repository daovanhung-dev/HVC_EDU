const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  LEFT: 'Đã rời lớp',
  CLOSING: 'Đang chốt',
  SCHEDULED: 'Đã lên lịch',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng',
  EXCUSED: 'Có phép',
  LEAVE: 'Nghỉ phép',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân sự',
  TEACHER: 'Giáo viên',
  ASSISTANT: 'Trợ giảng',
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
    case 'COMPLETED':
    case 'PRESENT':
      return 'positive';
    case 'SCHEDULED':
    case 'LEAVE':
      return 'warning';
    case 'INACTIVE':
    case 'CANCELLED':
    case 'ABSENT':
      return 'danger';
    default:
      return 'neutral';
  }
}
