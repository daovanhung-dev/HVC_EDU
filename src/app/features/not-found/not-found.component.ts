import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({ selector: 'app-not-found', standalone: true, imports: [RouterLink], template: `<main class="auth-page"><section class="auth-card"><h1>404</h1><p>Không tìm thấy trang.</p><a class="primary link-button" routerLink="/dashboard">Về dashboard</a></section></main>` })
export class NotFoundComponent {}
