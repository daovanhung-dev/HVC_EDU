import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

const all = ['ADMIN', 'STAFF'];
const admin = ['ADMIN'];

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
      { path: 'classes', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/education/education-hub.component').then((m) => m.EducationHubComponent) },
      { path: 'classes/:id', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/classes/class-detail.component').then((m) => m.ClassDetailComponent) },
      { path: 'classes/:classId/sessions/:sessionId/attendance', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/attendance/attendance-session.component').then((m) => m.AttendanceSessionComponent) },
      { path: 'classes/:classId/sessions/:sessionId/evaluation', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/attendance/evaluation-session.component').then((m) => m.EvaluationSessionComponent) },
      { path: 'staff', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/people/people-hub.component').then((m) => m.PeopleHubComponent) },
      { path: 'staff/attendance', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/staff/staff-attendance.component').then((m) => m.StaffAttendanceComponent) },
      { path: 'finance', data: { roles: admin }, canActivate: [roleGuard], loadComponent: () => import('./features/finance/finance.component').then((m) => m.FinanceComponent) },
      { path: 'account', data: { roles: all }, canActivate: [roleGuard], loadComponent: () => import('./features/account/account.component').then((m) => m.AccountComponent) },
    ],
  },
  { path: '**', loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent) },
];
