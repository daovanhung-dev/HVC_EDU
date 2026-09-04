import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardService, DashboardSummary } from '../../core/services/dashboard.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { formatMoney } from '../../core/utils/money.util';
import { formatDate } from '../../core/utils/date.util';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ErrorStateComponent } from '../../shared/components/error-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

const emptySummary: DashboardSummary = {
  period: null,
  activeClasses: 0,
  activeStudents: 0,
  totalDue: 0,
  totalPaid: 0,
  totalDebt: 0,
  payrollTotal: 0,
  otherIncome: 0,
  otherExpense: 0,
  rewards: 0,
  profitBeforeFund: 0,
  fundContribution: 0,
  distributableProfit: 0,
  alerts: [],
  role: '',
  tasks: [],
  upcomingSessions: [],
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, AppIconComponent, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent, PageHeaderComponent, StatusBadgeComponent],
  template: `
    <app-page-header eyebrow="TỔNG QUAN" title="Bảng điều khiển" description="Tập trung vào việc cần làm và tình hình của kỳ đang chọn.">
      <button class="secondary" type="button" [disabled]="loading()" (click)="load()"><span class="button-icon">↻</span> Làm mới</button>
    </app-page-header>

    @if (loading()) {
      <app-loading-state label="Đang tổng hợp không gian làm việc…" />
    } @else if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else {
      <section class="welcome-strip card">
        <div><p class="eyebrow">{{ greeting() }}</p><h2>{{ auth.profile()?.full_name || 'Chào mừng bạn quay lại' }}</h2><p class="muted">{{ periodText() }} · Vai trò: {{ roleText() }}</p></div>
        <div class="welcome-period"><span>Kỳ làm việc</span><strong>{{ periodText() }}</strong></div>
      </section>

      <section class="section-heading"><div><p class="eyebrow">ƯU TIÊN</p><h2>Việc cần làm</h2><p class="muted">Các bước đang cần xử lý được đưa lên trước.</p></div></section>
      @if (data().tasks.length) {
        <section class="task-grid">
          @for (task of data().tasks; track task.code) {
            <a class="task-card card" [class.task-warning]="task.severity === 'WARNING'" [class.task-blocked]="task.severity === 'BLOCKED'" [routerLink]="task.route">
              <div class="task-card-top"><span class="task-dot"></span><span class="task-count">{{ task.count }}</span></div>
              <strong>{{ task.label }}</strong><span class="muted">{{ task.actionLabel }} <span aria-hidden="true">→</span></span>
            </a>
          }
        </section>
      } @else {
        <app-empty-state title="Không có việc tồn đọng" description="Các bước quan trọng của kỳ hiện tại đã được xử lý." />
      }

      <section class="section-heading section-heading-spaced"><div><p class="eyebrow">TÌNH HÌNH</p><h2>Chỉ số chính</h2></div></section>
      <section class="kpi-grid dashboard-kpis">
        <article class="metric-card card"><span>Lớp đang hoạt động</span><strong>{{ data().activeClasses }}</strong><small class="muted">Trong trung tâm</small></article>
        <article class="metric-card card"><span>Học sinh đang học</span><strong>{{ data().activeStudents }}</strong><small class="muted">Theo dữ liệu hiện tại</small></article>
        @if (financeVisible()) {
          <article class="metric-card card metric-money"><span>Phải thu</span><strong>{{ money(data().totalDue) }}</strong><small class="muted">Học phí kỳ này</small></article>
          <article class="metric-card card metric-money"><span>Đã thu</span><strong>{{ money(data().totalPaid) }}</strong><small class="muted">{{ collectionRate() }}% tỷ lệ thu</small></article>
          <article class="metric-card card metric-money"><span>Công nợ</span><strong class="danger-text">{{ money(data().totalDebt) }}</strong><small class="muted">Cần theo dõi</small></article>
          <article class="metric-card card metric-money"><span>Lợi nhuận phân phối</span><strong>{{ money(data().distributableProfit) }}</strong><small class="muted">Sau khi trích quỹ</small></article>
        } @else {
          <article class="metric-card card"><span>Quyền truy cập</span><strong class="metric-role">{{ roleText() }}</strong><small class="muted">Dữ liệu tài chính được bảo vệ</small></article>
        }
      </section>

      <section class="dashboard-columns">
        <section class="card section-card dashboard-panel">
          <div class="panel-heading"><div><p class="eyebrow">LỊCH LÀM VIỆC</p><h2>Sắp diễn ra</h2></div><a class="button-link" routerLink="/attendance">Xem tất cả</a></div>
          @if (data().upcomingSessions.length) {
            <div class="session-list">
              @for (session of data().upcomingSessions; track session.id) {
                <div class="session-row">
                  <div class="session-date"><strong>{{ day(session.session_date) }}</strong><span>{{ month(session.session_date) }}</span></div>
                  <div class="session-info"><strong>{{ session.class_code }} · {{ session.class_name }}</strong><span class="muted">{{ formatDate(session.session_date) }} · {{ session.start_time || 'Chưa đặt giờ' }}</span><span class="session-flags"><span [class.done]="session.attendance_marked">Điểm danh {{ session.attendance_marked ? 'đủ' : 'chưa đủ' }}</span><span [class.done]="session.evaluation_marked">Đánh giá {{ session.evaluation_marked ? 'đủ' : 'chưa đủ' }}</span></span></div>
                  <div class="session-actions"><app-status-badge [value]="session.status" /><a class="button-link" [routerLink]="['/attendance', session.id]">Mở</a></div>
                </div>
              }
            </div>
          } @else {
            <app-empty-state title="Chưa có buổi sắp tới" description="Hãy kiểm tra lịch lớp hoặc chọn kỳ kế toán khác." />
          }
        </section>

        <section class="card section-card dashboard-panel">
          <div class="panel-heading"><div><p class="eyebrow">THAO TÁC NHANH</p><h2>Mở ngay</h2></div></div>
          <div class="quick-action-list">
            <a class="quick-action" routerLink="/classes"><span class="quick-action-icon"><app-icon name="school" /></span><span><strong>Quản lý lớp học</strong><small>Xem lớp, roster và lịch</small></span><span>→</span></a>
            @if (teachingVisible()) { <a class="quick-action" routerLink="/attendance"><span class="quick-action-icon"><app-icon name="attendance" /></span><span><strong>Điểm danh & đánh giá</strong><small>Cập nhật tiến độ học sinh</small></span><span>→</span></a> }
            @if (financeVisible()) { <a class="quick-action" routerLink="/finance/tuition"><span class="quick-action-icon"><app-icon name="tuition" /></span><span><strong>Học phí</strong><small>Kiểm tra phải thu và công nợ</small></span><span>→</span></a> }
            @if (auth.role() === 'ADMIN') { <a class="quick-action" routerLink="/periods"><span class="quick-action-icon"><app-icon name="calendar" /></span><span><strong>Kỳ kế toán</strong><small>Kiểm tra dữ liệu và chốt kỳ</small></span><span>→</span></a> }
          </div>
        </section>
      </section>

      <section class="card section-card alert-panel">
        <div class="panel-heading"><div><p class="eyebrow">THEO DÕI</p><h2>Cảnh báo hệ thống</h2></div><a class="button-link" routerLink="/periods">Kiểm tra dữ liệu</a></div>
        @for (alert of data().alerts; track alert) { <p class="alert-line"><span class="task-dot"></span>{{ alert }}</p> } @empty { <p class="success-line">Không có cảnh báo mới trong kỳ này.</p> }
      </section>
    }
  `,
})
export class DashboardComponent implements OnInit {
  readonly data = signal<DashboardSummary>(emptySummary);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private readonly dashboard: DashboardService, readonly period: PeriodContextService, readonly auth: AuthService) {}

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.period.ready;
      const current = this.period.current();
      const result = await this.dashboard.load(current?.id);
      this.data.set({ ...emptySummary, ...result, tasks: result.tasks ?? [], upcomingSessions: result.upcomingSessions ?? [] });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Chưa tải được dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  financeVisible(): boolean { return ['ADMIN', 'ACCOUNTANT'].includes(this.auth.role() || ''); }
  teachingVisible(): boolean { return ['ADMIN', 'TEACHER', 'ASSISTANT'].includes(this.auth.role() || ''); }
  money(value: unknown): string { return formatMoney(Number(value || 0)); }
  collectionRate(): string { return this.data().totalDue ? ((this.data().totalPaid / this.data().totalDue) * 100).toFixed(1) : '0.0'; }
  periodText(): string { const current = this.period.current(); return current ? `Kỳ ${current.month}/${current.year}` : 'Chưa chọn kỳ'; }
  roleText(): string { return ({ ADMIN: 'Quản trị viên', ACCOUNTANT: 'Kế toán', TEACHER: 'Giáo viên', ASSISTANT: 'Trợ giảng' } as Record<string, string>)[this.auth.role() || ''] || 'Chưa xác định'; }
  greeting(): string { const hour = new Date().getHours(); return hour < 12 ? 'CHÀO BUỔI SÁNG' : hour < 18 ? 'CHÀO BUỔI CHIỀU' : 'CHÀO BUỔI TỐI'; }
  day(value: string): string { return value.slice(8, 10); }
  month(value: string): string { return value.slice(5, 7); }
  formatDate(value: string): string { return formatDate(value); }
}
