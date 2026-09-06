import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { WorkflowService, TeachingSession } from '../../core/services/workflow.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { ToastService } from '../../core/services/toast.service';
import { statusLabel } from '../../core/utils/status.util';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-teaching-schedule',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">GIẢNG DẠY</p><h1>Lịch dạy</h1><p class="page-description muted">Mở trực tiếp trên card buổi học để check-in/out, điểm danh và đánh giá.</p></div><div class="page-header-actions"><button class="secondary" type="button" [disabled]="loading()" (click)="load()">↻ Làm mới</button><a class="secondary" routerLink="/work">Công & lương</a></div></section>
    <section class="card schedule-toolbar"><label>Ngày<input type="date" [value]="selectedDate" (change)="dateChanged($event)" /></label><div class="view-toggle"><button type="button" [class.active]="view === 'day'" (click)="setView('day')">Ngày</button><button type="button" [class.active]="view === 'week'" (click)="setView('week')">Tuần</button></div><span class="muted">{{ sessions().length }} buổi trong phạm vi đang xem</span></section>
    @if (hasWeeklySchedule()) { <section class="schedule-notice"><strong>Đang hiển thị theo lịch tuần</strong><span>Buổi này chưa được sinh trong kỳ nên chỉ xem được lịch. Admin cần tạo kỳ và sinh buổi để mở điểm danh, đánh giá và check-in.</span></section> }
    @if (error()) { <section class="error-state"><div><strong>Không tải được lịch dạy</strong><p>{{ error() }}</p></div><button class="secondary" type="button" (click)="load()">Thử lại</button></section> }
    @else if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải lịch dạy…</span></section> }
    @else {
      <section class="schedule-grid">
        @for (session of sessions(); track session.id) {
          <article class="card session-card" [class.session-selected]="session.id === selectedSessionId">
            <div class="session-card-top"><div><p class="eyebrow">{{ session.session_date }} · {{ session.start_time || 'Chưa đặt giờ' }}</p><h2>{{ session.class?.code }} · {{ session.class?.name }}</h2></div>@if (session.source === 'WEEKLY_SCHEDULE') { <span class="badge tone-warning">Chưa sinh buổi</span> } @else { <app-status-badge [value]="session.status" /> }</div>
            <div class="session-card-meta">@if (session.source === 'WEEKLY_SCHEDULE') { <span>Nguồn lịch: <strong>Lịch tuần</strong></span><span class="muted">Chờ Admin tạo kỳ và sinh buổi</span> } @else { <span>Điểm danh học sinh: <strong>{{ session.status === 'COMPLETED' ? 'Mở để kiểm tra' : 'Theo buổi' }}</strong></span><span>Công: <app-status-badge [value]="session.work_attendance?.status || 'NONE'" /></span> }</div>
            @if (session.source === 'SESSION') { <div class="session-card-actions"><a class="secondary" [routerLink]="['/teaching-schedule', session.id, 'attendance']">Điểm danh</a><a class="secondary" [routerLink]="['/teaching-schedule', session.id, 'evaluation']">Đánh giá</a>@if (canCheckWork()) { @if (!session.work_attendance || session.work_attendance.status === 'REJECTED') { <button class="primary" type="button" [disabled]="busyId() === session.id" (click)="checkIn(session)">{{ busyId() === session.id ? 'Đang xử lý…' : session.work_attendance?.status === 'REJECTED' ? 'Check-in lại' : 'Check-in' }}</button> } @else if (session.work_attendance.status === 'IN_PROGRESS') { <button class="primary" type="button" [disabled]="busyId() === session.id" (click)="checkOut(session)">{{ busyId() === session.id ? 'Đang xử lý…' : 'Check-out' }}</button> } @else { <span class="muted work-note">{{ workStatus(session.work_attendance.status) }}</span> } }</div> } @else { <div class="session-card-actions"><span class="muted schedule-readonly-note">Chỉ xem lịch tuần</span></div> }
            @if (session.work_attendance?.status === 'REJECTED') { <p class="session-rejection">{{ session.work_attendance.rejection_reason || 'Admin yêu cầu gửi lại công.' }}</p> }
          </article>
        }
        @empty { <section class="card empty-state"><strong>Không có buổi học</strong><p class="muted">Chọn ngày khác hoặc kiểm tra cấu hình lịch của lớp trong tháng.</p></section> }
      </section>
    }
  `,
})
export class TeachingScheduleComponent implements OnInit {
  readonly sessions = signal<TeachingSession[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busyId = signal('');
  selectedDate = new Date().toISOString().slice(0, 10);
  selectedSessionId: string | null = null;
  view: 'day' | 'week' = 'day';

  constructor(private readonly workflow: WorkflowService, readonly period: PeriodContextService, readonly auth: AuthService, private readonly toast: ToastService, private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.selectedSessionId = this.route.snapshot.paramMap.get('sessionId');
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true); this.error.set('');
    try { await this.period.ready; let selected = this.selectedSessionId ? await this.workflow.teachingSession(this.selectedSessionId) : null; if (selected) this.selectedDate = selected.session_date; const range = this.range(); let rows = await this.workflow.teachingSchedule(range.from, range.to); if (selected && this.view === 'day') rows = rows.filter((item) => item.session_date === selected?.session_date); this.sessions.set(rows); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải lịch dạy.'); }
    finally { this.loading.set(false); }
  }

  range(): { from: string; to: string } { if (this.view === 'day') return { from: this.selectedDate, to: this.selectedDate }; const start = new Date(`${this.selectedDate}T00:00:00Z`); const day = start.getUTCDay() || 7; start.setUTCDate(start.getUTCDate() - day + 1); const end = new Date(start); end.setUTCDate(start.getUTCDate() + 6); return { from: this.iso(start), to: this.iso(end) }; }
  iso(value: Date): string { return value.toISOString().slice(0, 10); }
  dateChanged(event: Event): void { this.selectedSessionId = null; this.selectedDate = (event.target as HTMLInputElement).value; void this.load(); }
  setView(view: 'day' | 'week'): void { this.view = view; void this.load(); }
  canCheckWork(): boolean { return ['TEACHER', 'ASSISTANT'].includes(this.auth.role() || ''); }
  hasWeeklySchedule(): boolean { return this.sessions().some((session) => session.source === 'WEEKLY_SCHEDULE'); }
  workStatus(value: string): string { return value === 'SUBMITTED' ? 'Đã gửi, chờ duyệt' : value === 'APPROVED' ? 'Đã duyệt' : statusLabel(value); }

  async checkIn(session: TeachingSession): Promise<void> { await this.submit(session, 'CHECK_IN'); }
  async checkOut(session: TeachingSession): Promise<void> { await this.submit(session, 'CHECK_OUT'); }
  private async submit(session: TeachingSession, action: 'CHECK_IN' | 'CHECK_OUT'): Promise<void> { if (session.source !== 'SESSION' || !session.session_id) return; this.busyId.set(session.id); try { await this.workflow.submitWorkAttendance(session.session_id, action); this.toast.success(action === 'CHECK_IN' ? 'Đã check-in buổi học.' : 'Đã check-out và gửi công chờ duyệt.'); await this.load(); } catch (error) { this.toast.error(error instanceof Error ? error.message : 'Không thể cập nhật công.'); } finally { this.busyId.set(''); } }
}
