import { Component, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { NAVIGATION_SECTIONS, NavigationItem, NavigationSection, canAccessNavigationItem } from '../core/config/navigation.config';
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
          @for (section of navSections; track section.id) {
            <section class="nav-group" [class.is-collapsed]="!isExpanded(section.id)">
              <button class="nav-group-toggle" type="button" [attr.aria-expanded]="isExpanded(section.id)" (click)="toggleSection(section.id)">
                <span><strong>{{ section.label }}</strong><small>{{ section.description }}</small></span>
                <span class="nav-chevron" aria-hidden="true">{{ isExpanded(section.id) ? '⌄' : '›' }}</span>
              </button>
              @if (isExpanded(section.id)) {
                <div class="nav-items">
                  @for (item of section.items; track item.id) {
                    @if (canSee(item)) {
                      <a class="nav-item" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }" (click)="closeMobile()">
                        <app-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
                      </a>
                    } @else {
                      <button class="nav-item nav-item-locked" type="button" [attr.aria-label]="item.label + ': bị khóa'" [title]="lockMessage(item)" (click)="notifyLocked(item)">
                        <app-icon [name]="item.icon" /><span><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span><app-icon name="lock" />
                      </button>
                    }
                  }
                </div>
              }
            </section>
          }
        </nav>

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
            <app-period-selector />
            <div class="topbar-account"><div class="avatar avatar-small">{{ initials() }}</div><span>{{ auth.profile()?.full_name || 'Tài khoản' }}</span></div>
          </div>
        </header>
        <div class="route-container">
          @if (period.initialized()) { <router-outlet /> } @else { <section class="card section-card"><div class="loading-inline"><span class="loading-spinner"></span><span>Đang chuẩn bị không gian làm việc…</span></div></section> }
        </div>
      </main>

      <div class="toast-stack" aria-live="polite" aria-atomic="true">
        @for (item of toast.items(); track item.id) { <div class="toast" [class]="item.kind">{{ item.message }}</div> }
      </div>
    </div>
  `,
})
export class AppShellComponent {
  readonly navSections: NavigationSection[] = NAVIGATION_SECTIONS;
  readonly mobileOpen = signal(false);
  readonly currentUrl = signal('');
  readonly expandedSections = signal<Record<string, boolean>>(Object.fromEntries(NAVIGATION_SECTIONS.map((section) => [section.id, true])));

  constructor(readonly auth: AuthService, private readonly router: Router, readonly period: PeriodContextService, readonly toast: ToastService) {
    this.currentUrl.set(this.router.url);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects);
        this.closeMobile();
      }
    });
  }

  canSee(item: NavigationItem): boolean { return canAccessNavigationItem(item, this.auth.role()); }

  currentItem(): NavigationItem | null {
    const path = this.currentUrl().split('?')[0];
    const items = this.navSections.flatMap((section) => section.items);
    if (path.startsWith('/evaluations/')) return items.find((item) => item.id === 'attendance') ?? null;
    return items.find((item) => path === item.path || (item.path !== '/dashboard' && path.startsWith(`${item.path}/`))) ?? null;
  }

  currentPage(): string { return this.currentItem()?.label ?? 'Không tìm thấy trang'; }

  roleLabel(value: string | null | undefined): string { return roleLabel(value); }

  currentSection(): string {
    const item = this.currentItem();
    return this.navSections.find((section) => section.items.some((candidate) => candidate.id === item?.id))?.label ?? 'Hệ thống';
  }

  initials(): string {
    const name = this.auth.profile()?.full_name?.trim() || 'HC';
    return name.split(/\s+/).slice(-2).map((part) => part.charAt(0)).join('').toUpperCase();
  }

  isExpanded(sectionId: string): boolean { return this.expandedSections()[sectionId] ?? true; }

  toggleSection(sectionId: string): void {
    this.expandedSections.update((sections) => ({ ...sections, [sectionId]: !this.isExpanded(sectionId) }));
  }

  lockMessage(item: NavigationItem): string {
    return `Chức năng “${item.label}” dành cho ${item.roles.map((role) => roleLabel(role)).join(', ')}.`;
  }

  notifyLocked(item: NavigationItem): void { this.toast.show(this.lockMessage(item), 'info'); }
  openMobile(): void { this.mobileOpen.set(true); }
  closeMobile(): void { this.mobileOpen.set(false); }

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
