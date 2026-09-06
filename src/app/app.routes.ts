import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';
import { LegacyRedirectComponent } from './shared/components/legacy-redirect.component';

const all = ['ADMIN', 'ACCOUNTANT', 'TEACHER', 'ASSISTANT'];
const finance = ['ADMIN', 'ACCOUNTANT'];
const admin = ['ADMIN'];
const teaching = ['ADMIN', 'TEACHER', 'ASSISTANT'];

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent) },
  {
    path: '', canActivate: [authGuard], loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
      { path: 'periods', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/month-setup/month-setup.component').then((m) => m.MonthSetupComponent) },
      { path: 'classes/new', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/class-form.component').then((m) => m.ClassFormComponent) },
      { path: 'classes/:id/schedule', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/class-schedule.component').then((m) => m.ClassScheduleComponent) },
      { path: 'classes/:id', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/class-detail.component').then((m) => m.ClassDetailComponent) },
      { path: 'classes', data: { roles: ['ADMIN', 'ACCOUNTANT'] }, canActivate: [roleGuard], loadComponent: () => import('./features/education/education-hub.component').then((m) => m.EducationHubComponent) },
      { path: 'students/new', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/students/student-form.component').then((m) => m.StudentFormComponent) },
      { path: 'students/:id', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/students/student-detail.component').then((m) => m.StudentDetailComponent) },
      { path: 'students', data: { roles: ['ADMIN', 'ACCOUNTANT'] }, canActivate: [roleGuard], loadComponent: () => import('./features/education/education-hub.component').then((m) => m.EducationHubComponent) },
      { path: 'teaching-schedule/:sessionId/attendance', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/attendance/attendance-session.component').then((m) => m.AttendanceSessionComponent) },
      { path: 'teaching-schedule/:sessionId/evaluation', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/attendance/evaluation-session.component').then((m) => m.EvaluationSessionComponent) },
      { path: 'teaching-schedule/:sessionId', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/teaching/teaching-schedule.component').then((m) => m.TeachingScheduleComponent) },
      { path: 'teaching-schedule', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/teaching/teaching-schedule.component').then((m) => m.TeachingScheduleComponent) },
      { path: 'work', data: { roles: ['TEACHER', 'ASSISTANT'] }, canActivate: [roleGuard], loadComponent: () => import('./features/teaching/work.component').then((m) => m.WorkComponent) },
      { path: 'staff/:id', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/staff/staff-detail.component').then((m) => m.StaffDetailComponent) },
      { path: 'staff', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/people/people-hub.component').then((m) => m.PeopleHubComponent) },
      { path: 'finance', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/finance.component').then((m) => m.FinanceComponent) },
      { path: 'notifications', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent) },
      { path: 'account', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/account/account.component').then((m) => m.AccountComponent) },
      { path: 'settings', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/settings/settings-hub.component').then((m) => m.SettingsHubComponent) },

      // Bookmark compatibility: old finance screens are now tabs in /finance.
      { path: 'finance/tuition/:classId', data: { target: 'finance', defaultTab: 'tuition' }, component: LegacyRedirectComponent },
      { path: 'finance/tuition', data: { target: 'finance', defaultTab: 'tuition' }, component: LegacyRedirectComponent },
      { path: 'finance/payments/new', data: { target: 'finance', defaultTab: 'payment' }, component: LegacyRedirectComponent },
      { path: 'finance/debts', data: { target: 'finance', defaultTab: 'debts' }, component: LegacyRedirectComponent },
      { path: 'finance/transactions', data: { target: 'finance', defaultTab: 'transactions' }, component: LegacyRedirectComponent },
      { path: 'finance/rewards', data: { target: 'finance', defaultTab: 'rewards' }, component: LegacyRedirectComponent },
      { path: 'finance/fund-profit', data: { target: 'finance', defaultTab: 'profit' }, component: LegacyRedirectComponent },
      { path: 'payroll', data: { target: 'payroll' }, component: LegacyRedirectComponent },
      { path: 'assignments', data: { target: 'staff', defaultTab: 'assignments' }, component: LegacyRedirectComponent },
      { path: 'attendance/:sessionId', data: { target: 'teaching-schedule' }, component: LegacyRedirectComponent },
      { path: 'evaluations/:sessionId', data: { target: 'teaching-schedule' }, component: LegacyRedirectComponent },
      { path: 'attendance', data: { target: 'teaching-schedule' }, component: LegacyRedirectComponent },
      { path: 'audit', data: { target: 'settings', defaultTab: 'audit' }, component: LegacyRedirectComponent },
      { path: 'migration', data: { target: 'settings', defaultTab: 'migration' }, component: LegacyRedirectComponent },
      { path: 'reports/classes', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/reports/class-report.component').then((m) => m.ClassReportComponent) },
      { path: 'reports/students', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/reports/student-report.component').then((m) => m.StudentReportComponent) },
    ],
  },
  { path: '**', loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent) },
];
