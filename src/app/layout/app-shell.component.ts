import { Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { NAVIGATION_ITEMS, NavigationItem, SECONDARY_NAVIGATION, canAccessNavigationItem } from '../core/config/navigation.config';
import { NotificationService } from '../core/services/notification.service';
import { PeriodContextService } from '../core/services/period-context.service';
import { ToastService } from '../core/services/toast.service';
import { roleLabel } from '../core/utils/status.util';
import { AppIconComponent } from '../shared/components/app-icon.component';
import { PeriodSelectorComponent } from '../shared/components/period-selector.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppIconComponent, PeriodSelectorComponent],
  template: `
    <div class="shell" [class.sidebar-open]="mobileOpen()">
      @if (mobileOpen()) { <button class="mobile-scrim" type="button" aria-label="Đóng menu" (click)="closeMobile()"></button> }
      <aside class="sidebar" [class.is-open]="mobileOpen()" aria-label="Điều hướng chính">
        <div class="sidebar-header">
          <a class="brand" routerLink="/dashboard" (click)="closeMobile()">
            <span class="brand-mark">HC</span>
            <span><strong>HÙNG CƯỜNG</strong><small>Center Management</small></span>
          </a>
          <button class="icon-button sidebar-close" type="button" aria-label="Đóng menu" (click)="closeMobile()"><app-icon name="close" /></button>
        </div>

        <div class="workspace-card">
          <div class="avatar">{{ initials() }}</div>
          <div class="workspace-user"><strong>{{ auth.profile()?.full_name || 'Tài khoản' }}</strong><span>{{ roleLabel(auth.role()) }}</span></div>
        </div>

        <nav class="main-nav" aria-label="Các chức năng hệ thống">
          <div class="nav-items nav-items-flat">
            @for (item of navItems; track item.id) {
              @if (canSee(item)) {
                <a class="nav-item" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }" (click)="closeMobile()">
                  <app-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
                  @if (item.id === 'notifications' && notifications.unreadCount() > 0) { <span class="nav-unread">{{ notifications.unreadCount() > 99 ? '99+' : notifications.unreadCount() }}</span> }
                </a>
              }
            }
          </div>
        </nav>

        <div class="sidebar-secondary">
          @for (item of secondaryItems; track item.id) {
            @if (canSee(item)) {
              <a class="nav-item" [routerLink]="item.path" routerLinkActive="active" (click)="closeMobile()"><app-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span></a>
            }
          }
        </div>
        <div class="sidebar-footer">
          <button class="logout-button" type="button" (click)="logout()"><app-icon name="arrow-right" /><span>Đăng xuất</span></button>
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <div class="topbar-leading">
            <button class="icon-button mobile-menu" type="button" aria-label="Mở menu" (click)="openMobile()"><app-icon name="menu" /></button>
            <div class="breadcrumbs"><span>{{ currentSection() }}</span><strong>{{ currentPage() }}</strong></div>
          </div>
          <div class="topbar-actions">
            <a class="notification-link" routerLink="/notifications" aria-label="Mở thông báo"><app-icon name="bell" /> @if (notifications.unreadCount() > 0) { <span>{{ notifications.unreadCount() > 99 ? '99+' : notifications.unreadCount() }}</span> }</a>
            <app-period-selector />
            <div class="topbar-account"><div class="avatar avatar-small">{{ initials() }}</div><span>{{ auth.profile()?.full_name || 'Tài khoản' }}</span></div>
          </div>
        </header>
        <div class="route-container">
          @if (period.initialized()) { <router-outlet /> } @else { <section class="card section-card"><div class="loading-inline"><span class="loading-spinner"></span><span>Đang chuẩn bị không gian làm việc…</span></div></section> }
        </div>
      </main>

      <nav class="mobile-bottom-nav" aria-label="Điều hướng nhanh">
        @for (item of mobileItems(); track item.id) { <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }" (click)="closeMobile()"><app-icon [name]="item.icon" /><span>{{ item.label }}</span></a> }
      </nav>
      <div class="toast-stack" aria-live="polite" aria-atomic="true">
        @for (item of toast.items(); track item.id) { <div class="toast" [class]="item.kind">{{ item.message }}</div> }
      </div>
    </div>
  `,
})
export class AppShellComponent {
  readonly navItems = NAVIGATION_ITEMS;
  readonly secondaryItems = SECONDARY_NAVIGATION;
  readonly mobileOpen = signal(false);
  readonly currentUrl = signal('');

  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
    readonly period: PeriodContextService,
    readonly toast: ToastService,
    readonly notifications: NotificationService,
  ) {
    this.currentUrl.set(this.router.url);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
        this.closeMobile();
      }
    });
    void this.notifications.refreshCount().catch(() => undefined);
  }

  canSee(item: NavigationItem): boolean { return canAccessNavigationItem(item, this.auth.role()); }

  currentItem(): NavigationItem | null {
    const path = this.currentUrl().split('?')[0];
    const items = [...this.navItems, ...this.secondaryItems];
    if (path.startsWith('/evaluations/') || path.startsWith('/attendance')) return items.find((item) => item.id === 'teaching-schedule') ?? null;
    return items.find((item) => path === item.path || (item.path !== '/dashboard' && path.startsWith(`${item.path}/`))) ?? null;
  }

  currentPage(): string { return this.currentItem()?.label ?? 'Không tìm thấy trang'; }
  currentSection(): string { return this.currentItem()?.id === 'account' || this.currentItem()?.id === 'settings' ? 'Hệ thống' : 'Không gian làm việc'; }
  roleLabel(value: string | null | undefined): string { return roleLabel(value); }

  initials(): string {
    const name = this.auth.profile()?.full_name?.trim() || 'HC';
    return name.split(/\s+/).slice(-2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  mobileItems(): NavigationItem[] {
    const preferred = ['home', 'teaching-schedule', 'work', 'notifications', 'account'];
    return preferred.map((id) => [...this.navItems, ...this.secondaryItems].find((item) => item.id === id)).filter((item): item is NavigationItem => !!item && this.canSee(item));
  }

  openMobile(): void { this.mobileOpen.set(true); }
  closeMobile(): void { this.mobileOpen.set(false); }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
