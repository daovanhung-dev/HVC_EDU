import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">HÙNG CƯỜNG</div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">Tổng quan</a>
          <a routerLink="/classes" routerLinkActive="active">Lớp học</a>
          <a routerLink="/students" routerLinkActive="active">Học sinh</a>
          <a routerLink="/attendance" routerLinkActive="active">Điểm danh</a>
          <a routerLink="/finance" routerLinkActive="active">Tài chính</a>
          <a routerLink="/staff" routerLinkActive="active">Nhân sự</a>
          <a routerLink="/settings" routerLinkActive="active">Thiết lập</a>
        </nav>
        <button class="ghost" type="button" (click)="logout()">Đăng xuất</button>
      </aside>
      <main class="content"><router-outlet /></main>
    </div>
  `,
})
export class AppShellComponent {
  constructor(private readonly auth: AuthService, private readonly router: Router) {}

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
