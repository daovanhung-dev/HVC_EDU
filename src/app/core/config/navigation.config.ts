import type { AppRole } from '../auth/auth.models';

export type NavigationItem = {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: string;
  roles: AppRole[];
};

const all: AppRole[] = ['ADMIN', 'STAFF'];
const admin: AppRole[] = ['ADMIN'];
const staff: AppRole[] = ['ADMIN', 'STAFF'];

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: 'dashboard', path: '/dashboard', label: 'Tổng quan', description: 'Số liệu và lịch vận hành', icon: 'dashboard', roles: all },
  { id: 'classes', path: '/classes', label: 'Lớp học', description: 'Lớp, học sinh và lịch học', icon: 'school', roles: staff },
  { id: 'staff', path: '/staff', label: 'Nhân sự', description: 'Nhân sự và phân công', icon: 'people', roles: admin },
  { id: 'staff-attendance', path: '/staff/attendance', label: 'Chấm công', description: 'Chấm công theo ngày', icon: 'attendance', roles: staff },
  { id: 'finance', path: '/finance', label: 'Thu chi', description: 'Doanh thu, khoản thu và chi', icon: 'finance', roles: admin },
];

export const SECONDARY_NAVIGATION: NavigationItem[] = [
  { id: 'account', path: '/account', label: 'Tài khoản', description: 'Thông tin và mật khẩu', icon: 'people', roles: all },
];

export function canAccessNavigationItem(item: NavigationItem, role: AppRole | null): boolean {
  return !!role && item.roles.includes(role);
}
