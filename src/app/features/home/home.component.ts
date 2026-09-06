import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardSummary, MinimalService } from '../../core/services/minimal.service';
import { formatMoney } from '../../core/utils/money.util';

const empty: DashboardSummary = { from_date: '', to_date: '', active_classes: 0, active_students: 0, active_staff: 0, sessions: 0, income: 0, expense: 0, balance: 0, role: '' };

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">TỔNG QUAN</p><h1>Xin chào, {{ auth.profile()?.full_name || 'bạn' }}</h1><p class="page-description muted">Các số liệu chính của trung tâm trong khoảng thời gian đang xem.</p></div><button class="secondary" type="button" [disabled]="loading()" (click)="load()">↻ Làm mới</button></section>
    <section class="toolbar card compact-toolbar"><label>Từ ngày<input type="date" [(ngModel)]="fromDate" /></label><label>Đến ngày<input type="date" [(ngModel)]="toDate" /></label><button class="primary" type="button" [disabled]="loading()" (click)="load()">Xem</button></section>
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải tổng quan…</span></section> }
    @else if (error()) { <section class="error-state"><div><strong>Không tải được tổng quan</strong><p>{{ error() }}</p></div><button class="secondary" type="button" (click)="load()">Thử lại</button></section> }
    @else {
      <section class="kpi-grid"><article class="card metric-card"><span>Lớp hoạt động</span><strong>{{ data().active_classes }}</strong><small class="muted">{{ data().from_date }} → {{ data().to_date }}</small></article><article class="card metric-card"><span>Học sinh</span><strong>{{ data().active_students }}</strong><small class="muted">Đang theo học</small></article><article class="card metric-card"><span>Nhân sự</span><strong>{{ data().active_staff }}</strong><small class="muted">Đang hoạt động</small></article><article class="card metric-card"><span>Buổi học</span><strong>{{ data().sessions }}</strong><small class="muted">Trong khoảng đã chọn</small></article></section>
      @if (auth.role() === 'ADMIN') { <section class="kpi-grid section-heading-spaced"><article class="card metric-card metric-money"><span>Tổng thu</span><strong>{{ money(data().income) }}</strong></article><article class="card metric-card metric-money"><span>Tổng chi</span><strong>{{ money(data().expense) }}</strong></article><article class="card metric-card metric-money"><span>Số dư</span><strong [class.danger-text]="data().balance < 0">{{ money(data().balance) }}</strong></article></section> }
      <section class="card section-card section-heading-spaced"><div class="panel-heading"><div><p class="eyebrow">THAO TÁC NHANH</p><h2>Đi đến chức năng</h2></div></div><div class="quick-action-list"><a class="quick-action" routerLink="/classes"><span><strong>Lớp học</strong><small>Roster, lịch tuần, buổi học, điểm danh và nhận xét</small></span><span>→</span></a>@if (auth.role() === 'ADMIN') { <a class="quick-action" routerLink="/staff"><span><strong>Nhân sự</strong><small>Hồ sơ, phân công và tài khoản Staff</small></span><span>→</span></a><a class="quick-action" routerLink="/finance"><span><strong>Thu chi</strong><small>Doanh thu và các khoản thu chi</small></span><span>→</span></a> } @else { <a class="quick-action" routerLink="/staff/attendance"><span><strong>Chấm công</strong><small>Ghi nhận chấm công cá nhân theo ngày</small></span><span>→</span></a> }</div></section>
    }
  `,
})
export class HomeComponent implements OnInit {
  readonly data = signal<DashboardSummary>(empty);
  readonly loading = signal(true);
  readonly error = signal('');
  fromDate = '';
  toDate = '';
  constructor(readonly auth: AuthService, private readonly minimal: MinimalService) { const range = MinimalService.currentMonth(); this.fromDate = range.from; this.toDate = range.to; }
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { this.data.set(await this.minimal.dashboard(this.fromDate, this.toDate)); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải tổng quan.'); } finally { this.loading.set(false); } }
  money(value: unknown): string { return formatMoney(Number(value || 0)); }
}
