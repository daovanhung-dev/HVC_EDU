import type { AppRole } from '../auth/auth.models';

export type NavigationItem = {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: string;
  roles: AppRole[];
};

const all: AppRole[] = ['ADMIN', 'ACCOUNTANT', 'TEACHER', 'ASSISTANT'];
const finance: AppRole[] = ['ADMIN', 'ACCOUNTANT'];
const admin: AppRole[] = ['ADMIN'];
const teaching: AppRole[] = ['ADMIN', 'TEACHER', 'ASSISTANT'];

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'home', path: '/dashboard', label: 'Trang chủ', description: 'Việc cần làm và lịch hôm nay', icon: 'dashboard', roles: all },
  { id: 'months', path: '/periods', label: 'Tháng', description: 'Tạo, vận hành và chốt tháng', icon: 'calendar', roles: admin },
  { id: 'classes', path: '/classes', label: 'Lớp', description: 'Lớp, học sinh và lịch học', icon: 'school', roles: ['ADMIN', 'ACCOUNTANT'] },
  { id: 'students', path: '/students', label: 'Học sinh', description: 'Roster, học phí và lịch sử', icon: 'student', roles: ['ADMIN', 'ACCOUNTANT'] },
  { id: 'teaching-schedule', path: '/teaching-schedule', label: 'Lịch dạy', description: 'Buổi học, điểm danh và check-in', icon: 'attendance', roles: teaching },
  { id: 'staff', path: '/staff', label: 'Nhân sự', description: 'Phân công, công và tài khoản', icon: 'people', roles: admin },
  { id: 'finance', path: '/finance', label: 'Kế toán', description: 'Học phí, thu chi, lương và lợi nhuận', icon: 'tuition', roles: finance },
  { id: 'work', path: '/work', label: 'Công & Lương', description: 'Công đã gửi và lương dự kiến', icon: 'payroll', roles: ['TEACHER', 'ASSISTANT'] },
  { id: 'notifications', path: '/notifications', label: 'Thông báo', description: 'Nhắc việc và thông tin trung tâm', icon: 'bell', roles: all },
];

export const SECONDARY_NAVIGATION: NavigationItem[] = [
  { id: 'settings', path: '/settings', label: 'Cài đặt', description: 'Chính sách, import và tài khoản', icon: 'settings', roles: admin },
  { id: 'account', path: '/account', label: 'Tài khoản', description: 'Thông tin cá nhân và mật khẩu', icon: 'people', roles: all },
];

export function canAccessNavigationItem(item: NavigationItem, role: AppRole | null): boolean {
  return !!role && item.roles.includes(role);
}
