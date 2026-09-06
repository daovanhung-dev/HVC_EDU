import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RootAuthService } from '../../core/auth/root-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="auth-page">
      <form class="auth-card" (ngSubmit)="submit()">
        <div>
          <p class="eyebrow">TRUNG TÂM HÙNG CƯỜNG</p>
          <h1>Đăng nhập hệ thống</h1>
        <p class="muted">Quản lý trung tâm Hùng Cường</p>
        </div>

        <label>Email hoặc tài khoản<input type="text" name="email" [(ngModel)]="email" autocomplete="username" required /></label>
        <label>Mật khẩu<div class="password-field"><input [type]="showPassword ? 'text' : 'password'" name="password" [(ngModel)]="password" autocomplete="current-password" required /><button class="secondary" type="button" (click)="showPassword=!showPassword">{{ showPassword ? 'Ẩn' : 'Hiện' }}</button></div></label>

        @if (error()) { <div class="alert">{{ error() }}</div> }
        <button class="primary" type="submit" [disabled]="loading()">
          {{ loading() ? 'Đang đăng nhập…' : 'Đăng nhập' }}
        </button>
        <button class="button-link link-button" type="button" (click)="forgotPassword()">Quên mật khẩu?</button>
      </form>
    </main>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly auth: AuthService, private readonly rootAuth: RootAuthService, private readonly router: Router, route: ActivatedRoute) {
    if (route.snapshot.queryParamMap.get('reason') === 'session-expired') {
      this.error.set('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    } else if (route.snapshot.queryParamMap.get('reason') === 'root-session-expired') {
      this.error.set('Phiên Root đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const identifier = this.email.trim();
      if (identifier.toLowerCase() === 'admin') {
        await this.auth.signOut().catch(() => undefined);
        await this.rootAuth.login(identifier, this.password);
        await this.router.navigateByUrl('/root/admins');
      } else {
        await this.auth.signIn(identifier, this.password);
        await this.router.navigateByUrl('/dashboard');
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      this.loading.set(false);
    }
  }

  async forgotPassword(): Promise<void> {
    if (!this.email.trim() || !this.email.includes('@')) { this.error.set('Nhập email trước khi yêu cầu đặt lại mật khẩu.'); return; }
    try {
      await this.auth.resetPassword(this.email.trim());
      this.error.set('Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.');
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể gửi email đặt lại mật khẩu.'); }
  }
}
