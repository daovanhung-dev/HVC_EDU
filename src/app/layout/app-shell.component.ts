import { Component, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { NAVIGATION_ITEMS, NavigationItem, SECONDARY_NAVIGATION, canAccessNavigationItem } from '../core/config/navigation.config';
import { ToastService } from '../core/services/toast.service';
import { roleLabel } from '../core/utils/status.util';
import { AppIconComponent } from '../shared/components/app-icon.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AppIconComponent],
  template: `
    <div class="shell" [class.sidebar-open]="mobileOpen()">
      @if (mobileOpen()) { <button class="mobile-scrim" type="button" aria-label="Đóng menu" (click)="closeMobile()"></button> }
      <aside class="sidebar" [class.is-open]="mobileOpen()" aria-label="Điều hướng chính">
        <div class="sidebar-header">
          <a class="brand" routerLink="/dashboard" (click)="closeMobile()"><span class="brand-mark">HC</span><span><strong>HÙNG CƯỜNG</strong><small>Quản lý trung tâm</small></span></a>
          <button class="icon-button sidebar-close" type="button" aria-label="Đóng menu" (click)="closeMobile()"><app-icon name="close" /></button>
        </div>
        <div class="workspace-card"><div class="avatar">{{ initials() }}</div><div class="workspace-user"><strong>{{ auth.profile()?.full_name || 'Tài khoản' }}</strong><span>{{ roleLabel(auth.role()) }}</span></div></div>
        <nav class="main-nav" aria-label="Các chức năng hệ thống">
          @for (item of navItems; track item.id) { @if (canSee(item)) {
            <a class="nav-item" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }" (click)="closeMobile()"><app-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span></a>
          } }
        </nav>
        <div class="sidebar-secondary">@for (item of secondaryItems; track item.id) { @if (canSee(item)) { <a class="nav-item" [routerLink]="item.path" routerLinkActive="active" (click)="closeMobile()"><app-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span></a> } }</div>
        <div class="sidebar-footer"><button class="logout-button" type="button" (click)="logout()"><app-icon name="arrow-right" /><span>Đăng xuất</span></button></div>
      </aside>
      <main class="content">
        <header class="topbar">
          <div class="topbar-leading"><button class="icon-button mobile-menu" type="button" aria-label="Mở menu" (click)="openMobile()"><app-icon name="menu" /></button><div class="breadcrumbs"><span>HVC EDU</span><strong>{{ currentPage() }}</strong></div></div>
          <div class="topbar-actions"><div class="topbar-account"><div class="avatar avatar-small">{{ initials() }}</div><span>{{ auth.profile()?.full_name || 'Tài khoản' }}</span></div></div>
        </header>
        <div class="route-container"><router-outlet /></div>
      </main>
      <nav class="mobile-bottom-nav" aria-label="Điều hướng nhanh">@for (item of mobileItems(); track item.id) { <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }" (click)="closeMobile()"><app-icon [name]="item.icon" /><span>{{ item.label }}</span></a> }</nav>
      <div class="toast-stack" aria-live="polite" aria-atomic="true">@for (item of toast.items(); track item.id) { <div class="toast" [class]="item.kind">{{ item.message }}</div> }</div>
    </div>
  `,
})
export class AppShellComponent implements OnDestroy {
  readonly navItems = NAVIGATION_ITEMS;
  readonly secondaryItems = SECONDARY_NAVIGATION;
  readonly mobileOpen = signal(false);
  readonly currentUrl = signal('');
  private readonly subscription: Subscription;

  constructor(readonly auth: AuthService, private readonly router: Router, readonly toast: ToastService) {
    this.currentUrl.set(this.router.url);
    this.subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) { this.currentUrl.set(event.urlAfterRedirects); this.closeMobile(); }
    });
  }

  ngOnDestroy(): void { this.subscription.unsubscribe(); }
  canSee(item: NavigationItem): boolean { return canAccessNavigationItem(item, this.auth.role()); }
  currentItem(): NavigationItem | null { const path = this.currentUrl().split('?')[0]; return [...this.navItems, ...this.secondaryItems].find((item) => path === item.path || (item.path !== '/dashboard' && path.startsWith(`${item.path}/`))) ?? null; }
  currentPage(): string { return this.currentItem()?.label ?? 'Trang'; }
  roleLabel(value: string | null | undefined): string { return roleLabel(value); }
  initials(): string { const name = this.auth.profile()?.full_name?.trim() || 'HC'; return name.split(/\s+/).slice(-2).map((part) => part.charAt(0)).join('').toUpperCase(); }
  mobileItems(): NavigationItem[] { return [...this.navItems, ...this.secondaryItems].filter((item) => this.canSee(item)).slice(0, 4); }
  openMobile(): void { this.mobileOpen.set(true); }
  closeMobile(): void { this.mobileOpen.set(false); }
  async logout(): Promise<void> { await this.auth.signOut(); await this.router.navigateByUrl('/login'); }
}
