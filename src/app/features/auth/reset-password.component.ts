import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="auth-page">
      <form class="auth-card" (ngSubmit)="submit()">
        <div><p class="eyebrow">TRUNG TÂM HÙNG CƯỜNG</p><h1>Đặt lại mật khẩu</h1><p class="muted">Liên kết khôi phục chỉ dùng được trong thời gian Supabase cho phép.</p></div>
        @if(error()){<div class="alert">{{error()}}</div>}
        @if(ready()){<label>Mật khẩu mới<input type="password" name="password" [(ngModel)]="password" autocomplete="new-password" required /></label><label>Nhập lại mật khẩu<input type="password" name="confirm" [(ngModel)]="confirmation" autocomplete="new-password" required /></label><button class="primary" [disabled]="loading()">{{loading()?'Đang cập nhật…':'Cập nhật mật khẩu'}}</button>}
      </form>
    </main>
  `,
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirmation = '';
  readonly ready = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  async ngOnInit() {
    try {
      const session = await this.auth.refreshSession();
      if (session) this.ready.set(true); else this.error.set('Liên kết khôi phục không hợp lệ hoặc đã hết hạn.');
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể xác thực liên kết khôi phục.'); }
  }

  async submit() {
    if (this.password.length < 8) { this.error.set('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    if (this.password !== this.confirmation) { this.error.set('Hai mật khẩu không khớp.'); return; }
    this.loading.set(true); this.error.set('');
    try { await this.auth.updatePassword(this.password); await this.auth.signOut(); await this.router.navigateByUrl('/login'); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể cập nhật mật khẩu.'); }
    finally { this.loading.set(false); }
  }
}
