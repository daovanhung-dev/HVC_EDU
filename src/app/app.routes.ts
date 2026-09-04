import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      { path: 'classes', loadComponent: () => import('./features/classes/classes.component').then((m) => m.ClassesComponent) },
      { path: 'students', loadComponent: () => import('./features/students/students.component').then((m) => m.StudentsComponent) },
      { path: 'attendance', loadComponent: () => import('./features/attendance/attendance.component').then((m) => m.AttendanceComponent) },
      { path: 'finance', loadComponent: () => import('./features/finance/finance.component').then((m) => m.FinanceComponent) },
      { path: 'staff', loadComponent: () => import('./features/staff/staff.component').then((m) => m.StaffComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent) },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
