import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';
import { NotificationService } from '../../core/services/notification.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { formatMoney } from '../../core/utils/money.util';
import { statusLabel } from '../../core/utils/status.util';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

const empty: DashboardSummary = {
  period: null, activeClasses: 0, activeStudents: 0, totalDue: 0, totalPaid: 0, totalDebt: 0,
  payrollTotal: 0, otherIncome: 0, otherExpense: 0, rewards: 0, profitBeforeFund: 0,
  fundContribution: 0, distributableProfit: 0, alerts: [], role: '', tasks: [], upcomingSessions: [],
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, AppIconComponent, StatusBadgeComponent],
  template: `
    <section class="page-header app-page-header">
      <div><p class="eyebrow">TRANG CHỦ</p><h1>{{ greeting() }}, {{ auth.profile()?.full_name || 'bạn' }}</h1><p class="page-description muted">Không gian điều hành theo vai trò, tập trung vào lịch hôm nay và các việc cần xử lý.</p></div>
      <button class="secondary" type="button" [disabled]="loading()" (click)="load()">↻ Làm mới</button>
    </section>
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải dashboard…</span></section> }
    @else if (error()) { <section class="error-state"><div><strong>Không tải được dashboard</strong><p>{{ error() }}</p></div><button class="secondary" type="button" (click)="load()">Thử lại</button></section> }
    @else {
      <section class="card welcome-strip"><div><p class="eyebrow">KỲ ĐANG LÀM VIỆC</p><h2>{{ periodLabel() }}</h2><p class="muted">{{ roleLabel() }} · Dữ liệu được giới hạn theo trung tâm và phân công.</p></div><a class="ghost" routerLink="/notifications"><app-icon name="bell" /> {{ notifications.unreadCount() }} thông báo chưa đọc</a></section>
      <section class="task-grid">
        @for (task of data().tasks; track task.code) { <a class="card task-card" [class.task-warning]="task.severity === 'WARNING'" [class.task-blocked]="task.severity === 'BLOCKED'" [routerLink]="task.route"><div class="task-card-top"><span class="task-dot"></span><span class="task-count">{{ task.count }}</span></div><strong>{{ task.label }}</strong><span class="muted">{{ task.actionLabel }} →</span></a> }
        @empty { <section class="card empty-state"><strong>Không có việc tồn đọng</strong><p class="muted">Các bước quan trọng của kỳ hiện tại đã được xử lý.</p></section> }
      </section>
      <section class="kpi-grid section-heading-spaced">
        <article class="card metric-card"><span>Lớp hoạt động</span><strong>{{ data().activeClasses }}</strong><small class="muted">Theo trung tâm</small></article>
        <article class="card metric-card"><span>Học sinh đang học</span><strong>{{ data().activeStudents }}</strong><small class="muted">Roster hiện tại</small></article>
        @if (financeVisible()) { <article class="card metric-card metric-money"><span>Phải thu</span><strong>{{ money(data().totalDue) }}</strong><small class="muted">{{ collectionRate() }}% đã thu</small></article><article class="card metric-card metric-money"><span>Công nợ</span><strong class="danger-text">{{ money(data().totalDebt) }}</strong><small class="muted">Cần theo dõi</small></article> }
        @else { <article class="card metric-card"><span>Buổi sắp tới</span><strong>{{ data().upcomingSessions.length }}</strong><small class="muted">Mở Lịch dạy để thao tác</small></article><article class="card metric-card"><span>Công chờ duyệt</span><strong>{{ data().pendingWorkAttendanceCount ?? 0 }}</strong><small class="muted">Theo trạng thái hiện tại</small></article> }
      </section>
      <section class="dashboard-columns">
        <section class="card section-card"><div class="panel-heading"><div><p class="eyebrow">LỊCH HÔM NAY & SẮP TỚI</p><h2>Buổi học cần chú ý</h2></div><a class="button-link" routerLink="/teaching-schedule">Mở lịch dạy</a></div>
          <div class="session-list">@for (session of data().upcomingSessions; track session.id) { <div class="session-row"><div class="session-date"><strong>{{ session.session_date.slice(8, 10) }}</strong><span>{{ session.session_date.slice(5, 7) }}</span></div><div class="session-info"><strong>{{ session.class_code }} · {{ session.class_name }}</strong><span class="muted">{{ session.session_date }} · {{ session.start_time || 'Chưa đặt giờ' }}</span><span class="session-flags"><span [class.done]="session.attendance_marked">Điểm danh {{ session.attendance_marked ? 'đủ' : 'chưa đủ' }}</span><span [class.done]="session.evaluation_marked">Đánh giá {{ session.evaluation_marked ? 'đủ' : 'chưa đủ' }}</span></span></div><div class="session-actions"><app-status-badge [value]="session.status" /><a class="button-link" [routerLink]="['/teaching-schedule', session.id]">Mở</a></div></div> } @empty { <div class="empty">Chưa có buổi học sắp tới.</div> }</div>
        </section>
        <section class="card section-card"><div class="panel-heading"><div><p class="eyebrow">ĐIỂM ĐẾN NHANH</p><h2>Mở ngay</h2></div></div><div class="quick-action-list"><a class="quick-action" routerLink="/teaching-schedule"><span class="quick-action-icon"><app-icon name="calendar" /></span><span><strong>Lịch dạy</strong><small>Check-in/out, điểm danh và đánh giá</small></span><span>→</span></a>@if (financeVisible()) { <a class="quick-action" [routerLink]="['/finance']" [queryParams]="{ tab: 'tuition' }"><span class="quick-action-icon"><app-icon name="tuition" /></span><span><strong>Kế toán</strong><small>Học phí, thu chi, lương và lợi nhuận</small></span><span>→</span></a> } @if (auth.role() === 'ADMIN') { <a class="quick-action" routerLink="/periods"><span class="quick-action-icon"><app-icon name="calendar" /></span><span><strong>Tạo tháng</strong><small>Copy cấu hình và tạo kỳ atomic</small></span><span>→</span></a> }</div></section>
      </section>
    }
  `,
})
export class HomeComponent implements OnInit {
  readonly data = signal<DashboardSummary>(empty);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(readonly auth: AuthService, readonly period: PeriodContextService, readonly notifications: NotificationService, private readonly dashboard: DashboardService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { await this.period.ready; this.data.set({ ...empty, ...(await this.dashboard.load(this.period.current()?.id)) }); await this.notifications.refreshCount(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải dashboard.'); } finally { this.loading.set(false); } }
  financeVisible(): boolean { return ['ADMIN', 'ACCOUNTANT'].includes(this.auth.role() || ''); }
  money(value: unknown): string { return formatMoney(Number(value || 0)); }
  collectionRate(): string { return this.data().totalDue ? ((this.data().totalPaid / this.data().totalDue) * 100).toFixed(1) : '0.0'; }
  periodLabel(): string { const current = this.period.current(); return current ? `Tháng ${current.month}/${current.year}` : 'Chưa chọn tháng'; }
  roleLabel(): string { return statusLabel(this.auth.role()); }
  greeting(): string { const hour = new Date().getHours(); return hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'; }
}
