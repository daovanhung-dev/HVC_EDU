import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">TÀI KHOẢN</p><h1>Thông tin cá nhân</h1><p class="page-description muted">Tài khoản được liên kết với vai trò và phạm vi dữ liệu hiện tại.</p></div></section>
    <section class="grid-2"><article class="card section-card"><p class="eyebrow">HỒ SƠ</p><h2>{{ auth.profile()?.full_name || 'Tài khoản' }}</h2><dl class="account-details"><div><dt>Email</dt><dd>{{ auth.user()?.email || '—' }}</dd></div><div><dt>Vai trò</dt><dd>{{ auth.role() || '—' }}</dd></div><div><dt>Mã trung tâm</dt><dd>{{ auth.profile()?.center_id || '—' }}</dd></div></dl></article><form class="card form-card" (ngSubmit)="updatePassword()"><p class="eyebrow">BẢO MẬT</p><h2>Đổi mật khẩu</h2><label>Mật khẩu mới<input type="password" name="password" [(ngModel)]="password" minlength="8" autocomplete="new-password" required /></label><label>Nhập lại mật khẩu<input type="password" name="confirm" [(ngModel)]="confirm" minlength="8" autocomplete="new-password" required /></label>@if(error()){<div class="alert">{{ error() }}</div>}<div class="form-actions"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Đang cập nhật…' : 'Cập nhật mật khẩu' }}</button></div></form></section>
  `,
})
export class AccountComponent {
  password = '';
  confirm = '';
  readonly error = signal('');
  saving = false;
  constructor(readonly auth: AuthService, private readonly toast: ToastService) {}
  async updatePassword(): Promise<void> { if (this.password.length < 8 || this.password !== this.confirm) { this.error.set('Mật khẩu tối thiểu 8 ký tự và hai ô phải giống nhau.'); return; } this.saving = true; this.error.set(''); try { await this.auth.updatePassword(this.password); this.password = ''; this.confirm = ''; this.toast.success('Đã cập nhật mật khẩu.'); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể cập nhật mật khẩu.'); } finally { this.saving = false; } }
}
