import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api/api-error';
import { RootAuthService } from '../../core/auth/root-auth.service';
import { RootAdminAccount, RootAdminList, RootAdminService } from '../../core/services/root-admin.service';

@Component({
  selector: 'app-root-admins',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="root-page">
      <header class="root-header">
        <div><p class="eyebrow">ROOT CONTROL PLANE</p><h1>Quản lý tài khoản Admin</h1><p class="muted">Root chỉ quản trị tài khoản, không truy cập dữ liệu vận hành của các center.</p></div>
        <button class="secondary" type="button" (click)="logout()">Đăng xuất</button>
      </header>

      @if (error()) { <div class="alert">{{ error() }}</div> }
      @if (message()) { <div class="success-alert">{{ message() }}</div> }

      <section class="card form-card root-form-card">
        <div class="panel-heading"><div><p class="eyebrow">TẠO TÀI KHOẢN</p><h2>Mời Admin mới</h2></div></div>
        <form (ngSubmit)="create()">
          <div class="form-grid">
            <label>Họ và tên<input name="full_name" [(ngModel)]="fullName" required /></label>
            <label>Email đăng nhập<input type="email" name="email" [(ngModel)]="email" autocomplete="email" required /></label>
            <label>Center<select name="center_id" [(ngModel)]="centerId" required><option value="">Chọn center</option>@for (center of centers(); track center.id) { <option [value]="center.id">{{ center.code }} · {{ center.name }}</option> }</select></label>
          </div>
          <div class="form-actions"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Đang gửi…' : 'Gửi lời mời Admin' }}</button></div>
        </form>
      </section>

      <section class="card section-card root-list-card">
        <div class="panel-heading"><div><p class="eyebrow">TÀI KHOẢN</p><h2>Danh sách Admin</h2></div><button class="secondary" type="button" [disabled]="loading()" (click)="load()">Làm mới</button></div>
        @if (loading()) { <div class="loading-state"><span class="loading-spinner"></span><span>Đang tải tài khoản…</span></div> } @else { <div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>Center</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>@for (admin of admins(); track admin.user_id) { <tr><td>{{ admin.full_name }}</td><td>{{ admin.email || '—' }}</td><td>{{ admin.center?.code || admin.center_id }}</td><td>{{ admin.active ? 'Đang hoạt động' : 'Đã khóa' }}</td><td>@if (admin.active) { <button class="button-link link-button danger-text" type="button" (click)="deactivate(admin)">Khóa</button> } @else { <span class="muted">Đã khóa</span> }</td></tr> } @empty { <tr><td colspan="5" class="empty">Chưa có tài khoản Admin.</td></tr> }</tbody></table></div> }
      </section>
    </main>
  `,
})
export class RootAdminsComponent implements OnInit {
  readonly admins = signal<RootAdminAccount[]>([]);
  readonly centers = signal<RootAdminList['centers']>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  fullName = '';
  email = '';
  centerId = '';
  saving = false;

  constructor(private readonly rootAuth: RootAuthService, private readonly rootAdmin: RootAdminService, private readonly router: Router) {}

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.rootAdmin.list();
      this.admins.set(result.admins);
      this.centers.set(result.centers);
      if (!this.centerId && result.centers[0]) this.centerId = result.centers[0].id;
    } catch (error) { this.handleError(error); } finally { this.loading.set(false); }
  }

  async create(): Promise<void> {
    if (!this.fullName.trim() || !/^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(this.email.trim()) || !this.centerId) {
      this.error.set('Vui lòng nhập họ tên, email hợp lệ và center.');
      return;
    }
    this.saving = true;
    this.error.set('');
    this.message.set('');
    try {
      await this.rootAdmin.create(this.fullName.trim(), this.email.trim(), this.centerId);
      this.fullName = '';
      this.email = '';
      this.message.set('Đã gửi lời mời tài khoản Admin.');
      await this.load();
    } catch (error) { this.handleError(error); } finally { this.saving = false; }
  }

  async deactivate(admin: RootAdminAccount): Promise<void> {
    if (!confirm(`Khóa tài khoản Admin ${admin.full_name}?`)) return;
    this.error.set('');
    this.message.set('');
    try {
      await this.rootAdmin.deactivate(admin.user_id);
      this.message.set('Đã khóa tài khoản Admin.');
      await this.load();
    } catch (error) { this.handleError(error); }
  }

  async logout(): Promise<void> {
    await this.rootAuth.logout();
    await this.router.navigateByUrl('/login');
  }

  private handleError(error: unknown): void {
    if (error instanceof ApiError && error.code === 'ROOT_UNAUTHENTICATED') {
      this.rootAuth.clearSession();
      void this.router.navigateByUrl('/login?reason=root-session-expired');
      return;
    }
    this.error.set(error instanceof Error ? error.message : 'Không thể hoàn tất thao tác Root.');
  }
}

