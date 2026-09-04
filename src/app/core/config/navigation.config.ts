import type { AppRole } from '../auth/auth.models';

export type NavigationSectionId = 'overview' | 'education' | 'finance' | 'people' | 'reports' | 'system';

export type NavigationItem = {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: string;
  roles: AppRole[];
};

export type NavigationSection = {
  id: NavigationSectionId;
  label: string;
  description: string;
  items: NavigationItem[];
};

const all: AppRole[] = ['ADMIN', 'ACCOUNTANT', 'TEACHER', 'ASSISTANT'];
const finance: AppRole[] = ['ADMIN', 'ACCOUNTANT'];
const admin: AppRole[] = ['ADMIN'];
const teaching: AppRole[] = ['ADMIN', 'TEACHER', 'ASSISTANT'];

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    id: 'overview',
    label: 'Tổng quan',
    description: 'Việc cần làm và tình hình trung tâm',
    items: [
      { id: 'dashboard', path: '/dashboard', label: 'Bảng điều khiển', description: 'Việc cần làm, cảnh báo và chỉ số chính', icon: 'dashboard', roles: all },
    ],
  },
  {
    id: 'education',
    label: 'Đào tạo',
    description: 'Lớp, học sinh và vận hành buổi học',
    items: [
      { id: 'classes', path: '/classes', label: 'Lớp học', description: 'Danh sách lớp, roster và lịch học', icon: 'school', roles: all },
      { id: 'students', path: '/students', label: 'Học sinh', description: 'Hồ sơ, xếp lớp và lịch sử học tập', icon: 'student', roles: all },
      { id: 'attendance', path: '/attendance', label: 'Điểm danh & đánh giá', description: 'Cập nhật C/N/P và nhận xét từng buổi', icon: 'attendance', roles: teaching },
    ],
  },
  {
    id: 'finance',
    label: 'Tài chính',
    description: 'Thu học phí, công nợ và chi phí',
    items: [
      { id: 'finance-hub', path: '/finance', label: 'Trung tâm tài chính', description: 'Chọn phân hệ và quy trình cần xử lý', icon: 'dashboard', roles: finance },
      { id: 'tuition', path: '/finance/tuition', label: 'Học phí', description: 'Phải thu, đã thu và ledger theo lớp', icon: 'tuition', roles: finance },
      { id: 'payment', path: '/finance/payments/new', label: 'Ghi nhận payment', description: 'Ghi nhận khoản thu học phí', icon: 'payment', roles: finance },
      { id: 'debts', path: '/finance/debts', label: 'Công nợ & chuyển kỳ', description: 'Nợ đầu kỳ, điều chỉnh và carry-over', icon: 'debt', roles: finance },
      { id: 'transactions', path: '/finance/transactions', label: 'Thu/chi khác', description: 'Giao dịch ngoài học phí', icon: 'transactions', roles: finance },
      { id: 'rewards', path: '/finance/rewards', label: 'Thưởng học sinh', description: 'Quản lý khoản thưởng theo kỳ', icon: 'reward', roles: finance },
      { id: 'payroll', path: '/payroll', label: 'Payroll', description: 'Preview, lưu draft và duyệt lương', icon: 'payroll', roles: finance },
      { id: 'fund-profit', path: '/finance/fund-profit', label: 'Quỹ & lợi nhuận', description: 'Trích quỹ và phân phối lợi nhuận', icon: 'profit', roles: admin },
    ],
  },
  {
    id: 'people',
    label: 'Nhân sự',
    description: 'Nhân sự và phân công giảng dạy',
    items: [
      { id: 'staff', path: '/staff', label: 'Nhân sự', description: 'Hồ sơ, tài khoản và trạng thái', icon: 'people', roles: finance },
      { id: 'assignments', path: '/assignments', label: 'Phân công', description: 'Gán giáo viên/trợ giảng theo lớp', icon: 'assignment', roles: admin },
    ],
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    description: 'Theo dõi kết quả lớp và học sinh',
    items: [
      { id: 'class-reports', path: '/reports/classes', label: 'Báo cáo theo lớp', description: 'Sĩ số, chuyên cần, thu và lợi nhuận', icon: 'chart', roles: all },
      { id: 'student-reports', path: '/reports/students', label: 'Báo cáo học sinh', description: 'Chuyên cần, điểm và nhận xét', icon: 'report', roles: teaching },
    ],
  },
  {
    id: 'system',
    label: 'Hệ thống',
    description: 'Kỳ kế toán, cấu hình và dữ liệu',
    items: [
      { id: 'periods', path: '/periods', label: 'Kỳ kế toán', description: 'Mở kỳ, kiểm tra blocker và đóng kỳ', icon: 'calendar', roles: finance },
      { id: 'settings', path: '/settings', label: 'Thiết lập', description: 'Chính sách, quỹ và phân quyền', icon: 'settings', roles: admin },
      { id: 'audit', path: '/audit', label: 'Nhật ký hệ thống', description: 'Theo dõi ai đã thay đổi dữ liệu', icon: 'audit', roles: admin },
      { id: 'migration', path: '/migration', label: 'Import Excel', description: 'Validate, import và đối soát workbook', icon: 'import', roles: admin },
    ],
  },
];

export function canAccessNavigationItem(item: NavigationItem, role: AppRole | null): boolean {
  return !!role && item.roles.includes(role);
}
