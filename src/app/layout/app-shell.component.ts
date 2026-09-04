import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { PeriodContextService } from '../core/services/period-context.service';
import { ToastService } from '../core/services/toast.service';
import type { AppRole } from '../core/auth/auth.models';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">HÙNG CƯỜNG</div>
        <div class="user-block"><strong>{{ auth.profile()?.full_name || 'Tài khoản' }}</strong><span>{{ roleLabel(auth.role()) }}</span></div>
        <nav>
          @for (item of nav; track item.path) { @if (canSee(item.roles)) { <a [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a> } }
        </nav>
        <button class="ghost" type="button" (click)="logout()">Đăng xuất</button>
      </aside>
      <main class="content">
        <div class="topbar">
          <span>{{ period.current() ? ('Kỳ ' + period.current()!.month + '/' + period.current()!.year) : 'Chưa chọn kỳ' }}</span>
          <select [value]="period.current()?.id || ''" (change)="selectPeriod($any($event.target).value)">
            @for (item of period.periods(); track item.id) { <option [value]="item.id">{{ item.month }}/{{ item.year }} · {{ item.status }}</option> }
          </select>
        </div>
        @if (period.initialized()) { <router-outlet /> } @else { <section class="card section-card"><p>Đang tải kỳ kế toán…</p></section> }
      </main>
      <div class="toast-stack">@for (item of toast.items(); track item.id) { <div class="toast" [class]="item.kind">{{ item.message }}</div> }</div>
    </div>
  `,
})
export class AppShellComponent {
  readonly nav: Array<{ path: string; label: string; roles: AppRole[] }> = [
    { path: '/dashboard', label: 'Tổng quan', roles: ['ADMIN','ACCOUNTANT','TEACHER','ASSISTANT'] },
    { path: '/classes', label: 'Lớp học', roles: ['ADMIN','ACCOUNTANT','TEACHER','ASSISTANT'] },
    { path: '/students', label: 'Học sinh', roles: ['ADMIN','ACCOUNTANT','TEACHER','ASSISTANT'] },
    { path: '/attendance', label: 'Điểm danh', roles: ['ADMIN','TEACHER','ASSISTANT'] },
    { path: '/finance/tuition', label: 'Học phí', roles: ['ADMIN','ACCOUNTANT'] },
    { path: '/finance/transactions', label: 'Thu chi', roles: ['ADMIN','ACCOUNTANT'] },
    { path: '/payroll', label: 'Lương', roles: ['ADMIN','ACCOUNTANT'] },
    { path: '/reports/classes', label: 'Báo cáo', roles: ['ADMIN','ACCOUNTANT','TEACHER','ASSISTANT'] },
    { path: '/staff', label: 'Nhân sự', roles: ['ADMIN','ACCOUNTANT'] },
    { path: '/periods', label: 'Kỳ kế toán', roles: ['ADMIN','ACCOUNTANT'] },
    { path: '/settings', label: 'Thiết lập', roles: ['ADMIN'] },
    { path: '/audit', label: 'Audit', roles: ['ADMIN'] },
    { path: '/migration', label: 'Import Excel', roles: ['ADMIN'] },
  ];
  constructor(readonly auth: AuthService, private readonly router: Router, readonly period: PeriodContextService, readonly toast: ToastService) {}

  canSee(roles: AppRole[]): boolean { const role = this.auth.role(); return !!role && roles.includes(role); }
  roleLabel(role: AppRole | null): string { return ({ ADMIN: 'Quản trị viên', ACCOUNTANT: 'Kế toán', TEACHER: 'Giáo viên', ASSISTANT: 'Trợ giảng' } as Record<string, string>)[role ?? ''] ?? ''; }
  selectPeriod(id: string): void { const selected = this.period.periods().find((item) => item.id === id); if (selected) this.period.select(selected); }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
