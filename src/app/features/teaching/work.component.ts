import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { WorkflowService, WorkAttendance } from '../../core/services/workflow.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { ToastService } from '../../core/services/toast.service';
import { formatMoney } from '../../core/utils/money.util';
import { statusLabel } from '../../core/utils/status.util';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-work',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">NHÂN SỰ</p><h1>Công & lương</h1><p class="page-description muted">Chỉ công theo buổi đã được Admin duyệt mới đi vào payroll của tháng mới.</p></div><a class="secondary" routerLink="/teaching-schedule">Mở lịch dạy</a></section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    <section class="kpi-grid"><article class="card metric-card"><span>Buổi đã duyệt</span><strong>{{ approvedCount() }}</strong><small class="muted">Được tính payroll</small></article><article class="card metric-card"><span>Chờ duyệt</span><strong>{{ submittedCount() }}</strong><small class="muted">Admin sẽ kiểm tra</small></article><article class="card metric-card"><span>Bị từ chối</span><strong class="danger-text">{{ rejectedCount() }}</strong><small class="muted">Cần check-in lại</small></article><article class="card metric-card metric-money"><span>Tháng đang chọn</span><strong>{{ periodLabel() }}</strong><small class="muted">Tạm tính theo policy server</small></article></section>
    <section class="card section-card"><div class="panel-heading"><div><p class="eyebrow">REQUEST CÔNG</p><h2>Các buổi đã thao tác</h2></div><button class="secondary" type="button" [disabled]="loading()" (click)="load()">Làm mới</button></div><div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Lớp</th><th>Check-in</th><th>Check-out</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>@for(item of workRows(); track item.id){<tr><td>{{ item.session?.session_date }}</td><td>{{ item.session?.class?.code }} · {{ item.session?.class?.name }}</td><td>{{ item.check_in_at || '—' }}</td><td>{{ item.check_out_at || '—' }}</td><td><app-status-badge [value]="item.status" /></td><td>{{ item.rejection_reason || item.note || '—' }}</td></tr>}@empty{<tr><td colspan="6" class="empty">Chưa có request công. Mở Lịch dạy để check-in.</td></tr>}</tbody></table></div></section>
    <section class="card section-card availability-panel"><div class="panel-heading"><div><p class="eyebrow">LỊCH RẢNH</p><h2>Khung giờ có thể nhận lớp</h2><p class="muted">Lịch rảnh chỉ là dữ liệu hỗ trợ xếp lịch, không thay thế phân công.</p></div></div><form class="form-grid" (ngSubmit)="saveAvailability()"><label>Ngày<input type="date" name="availability_date" [(ngModel)]="availabilityForm.availability_date" required /></label><label>Bắt đầu<input type="time" name="start_time" [(ngModel)]="availabilityForm.start_time" required /></label><label>Kết thúc<input type="time" name="end_time" [(ngModel)]="availabilityForm.end_time" required /></label><label class="full">Ghi chú<input name="note" [(ngModel)]="availabilityForm.note" placeholder="Ví dụ: có thể nhận lớp tối" /></label><div class="form-actions full"><button class="primary" type="submit" [disabled]="savingAvailability">{{ savingAvailability ? 'Đang lưu…' : 'Lưu lịch rảnh' }}</button></div></form><div class="availability-list">@for(item of availabilities(); track item.id){<div><strong>{{ item.availability_date }}</strong><span>{{ item.start_time }} – {{ item.end_time }}</span><small>{{ item.note || '' }}</small></div>}@empty{<p class="muted">Chưa khai báo khung giờ rảnh trong tháng.</p>}</div></section>
  `,
})
export class WorkComponent implements OnInit {
  readonly workRows = signal<WorkAttendance[]>([]);
  readonly availabilities = signal<any[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  savingAvailability = false;
  availabilityForm = { availability_date: new Date().toISOString().slice(0, 10), start_time: '17:00', end_time: '20:00', note: '' };

  constructor(readonly auth: AuthService, readonly period: PeriodContextService, private readonly workflow: WorkflowService, private readonly toast: ToastService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { await this.period.ready; const p = this.period.current(); const staffId = this.auth.profile()?.staff_id; if (!p || !staffId) { this.workRows.set([]); return; } const sessions = await this.workflow.teachingSessions(p.id, p.start_date, p.end_date); this.workRows.set(sessions.map((session) => session.work_attendance).filter((item): item is WorkAttendance => !!item)); this.availabilities.set(await this.workflow.availability(staffId, p.start_date, p.end_date)); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải dữ liệu công.'); } finally { this.loading.set(false); } }
  approvedCount(): number { return this.workRows().filter((item) => item.status === 'APPROVED').length; }
  submittedCount(): number { return this.workRows().filter((item) => item.status === 'SUBMITTED' || item.status === 'IN_PROGRESS').length; }
  rejectedCount(): number { return this.workRows().filter((item) => item.status === 'REJECTED').length; }
  periodLabel(): string { const p = this.period.current(); return p ? `${p.month}/${p.year}` : '—'; }
  status(value: string): string { return statusLabel(value); }
  async saveAvailability(): Promise<void> { if (!this.availabilityForm.availability_date || !this.availabilityForm.start_time || !this.availabilityForm.end_time || this.availabilityForm.end_time <= this.availabilityForm.start_time) { this.error.set('Ngày và khung giờ lịch rảnh không hợp lệ.'); return; } this.savingAvailability = true; try { await this.workflow.saveAvailability(this.availabilityForm); this.toast.success('Đã lưu lịch rảnh.'); await this.load(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu lịch rảnh.'); } finally { this.savingAvailability = false; } }
  money(value: unknown): string { return formatMoney(Number(value || 0)); }
}
