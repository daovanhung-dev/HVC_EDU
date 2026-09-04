import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

const all = ['ADMIN','ACCOUNTANT','TEACHER','ASSISTANT'];
const finance = ['ADMIN','ACCOUNTANT'];
const admin = ['ADMIN'];
const teaching = ['ADMIN','TEACHER','ASSISTANT'];

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  {
    path: '', canActivate: [authGuard], loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'classes/new', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/class-form.component').then((m) => m.ClassFormComponent) },
      { path: 'classes/:id/schedule', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/class-schedule.component').then((m) => m.ClassScheduleComponent) },
      { path: 'classes/:id', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/class-detail.component').then((m) => m.ClassDetailComponent) },
      { path: 'students/new', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/students/student-form.component').then((m) => m.StudentFormComponent) },
      { path: 'students/:id', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/students/student-detail.component').then((m) => m.StudentDetailComponent) },
      { path: 'classes', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/classes.component').then((m) => m.ClassesComponent) },
      { path: 'students', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/students/students.component').then((m) => m.StudentsComponent) },
      { path: 'attendance', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent) },
      { path: 'attendance/:sessionId', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/attendance/attendance-session.component').then((m) => m.AttendanceSessionComponent) },
      { path: 'evaluations/:sessionId', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/attendance/evaluation-session.component').then((m) => m.EvaluationSessionComponent) },
      { path: 'staff', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/staff/staff.component').then((m) => m.StaffComponent) },
      { path: 'staff/:id', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/staff/staff-detail.component').then((m) => m.StaffDetailComponent) },
      { path: 'assignments', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/staff/assignments.component').then((m) => m.AssignmentsComponent) },
      { path: 'finance/tuition', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/tuition.component').then((m) => m.TuitionComponent) },
      { path: 'finance/tuition/:classId', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/tuition-class.component').then((m) => m.TuitionClassComponent) },
      { path: 'finance/payments/new', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/payment-form.component').then((m) => m.PaymentFormComponent) },
      { path: 'finance/debts', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/debts.component').then((m) => m.DebtsComponent) },
      { path: 'finance/transactions', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/transactions.component').then((m) => m.TransactionsComponent) },
      { path: 'finance/rewards', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/rewards.component').then((m) => m.RewardsComponent) },
      { path: 'finance/fund-profit', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/fund-profit.component').then((m) => m.FundProfitComponent) },
      { path: 'payroll', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/payroll.component').then((m) => m.PayrollComponent) },
      { path: 'reports/classes', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/reports/class-report.component').then((m) => m.ClassReportComponent) },
      { path: 'reports/students', data: { roles: teaching }, canActivate: [roleGuard], loadComponent: () => import('./features/reports/student-report.component').then((m) => m.StudentReportComponent) },
      { path: 'periods', data: { roles: finance }, canActivate: [roleGuard], loadComponent: () => import('./features/periods/periods.component').then((m) => m.PeriodsComponent) },
      { path: 'settings', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent) },
      { path: 'audit', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/audit/audit.component').then((m) => m.AuditComponent) },
      { path: 'migration', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/migration/migration.component').then((m) => m.MigrationComponent) },
    ],
  },
  { path: '**', loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent) },
];
