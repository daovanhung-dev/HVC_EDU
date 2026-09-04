import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="auth-page">
      <form class="auth-card" (ngSubmit)="submit()">
        <div>
          <p class="eyebrow">TRUNG TÂM HÙNG CƯỜNG</p>
          <h1>Đăng nhập quản trị</h1>
          <p class="muted">Angular + Supabase</p>
        </div>

        <label>Email<input type="email" name="email" [(ngModel)]="email" autocomplete="email" required /></label>
        <label>Mật khẩu<input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required /></label>

        @if (error()) { <div class="alert">{{ error() }}</div> }
        <button class="primary" type="submit" [disabled]="loading()">
          {{ loading() ? 'Đang đăng nhập…' : 'Đăng nhập' }}
        </button>
      </form>
    </main>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  async submit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signIn(this.email.trim(), this.password);
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      this.loading.set(false);
    }
  }
}
