import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PeriodContextService } from '../../core/services/period-context.service';
import { WorkflowService, WorkAttendance } from '../../core/services/workflow.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StaffComponent } from '../staff/staff.component';
import { AssignmentsComponent } from '../staff/assignments.component';

@Component({
  selector: 'app-people-hub',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, StaffComponent, AssignmentsComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">NHÂN SỰ</p><h1>{{ tab() === 'work-approval' ? 'Duyệt công' : 'Nhân sự & phân công' }}</h1><p class="page-description muted">Quản lý tài khoản, phân công và request công theo buổi trong cùng một hub.</p></div></section>
    <nav class="hub-tabs"><a [class.active]="tab() === 'staff'" [routerLink]="['/staff']" [queryParams]="{ tab: 'staff' }">Nhân sự</a><a [class.active]="tab() === 'assignments'" [routerLink]="['/staff']" [queryParams]="{ tab: 'assignments' }">Phân công</a><a [class.active]="tab() === 'work-approval'" [routerLink]="['/staff']" [queryParams]="{ tab: 'work-approval' }">Duyệt công <span class="tab-count">{{ queue().length }}</span></a></nav>
    @if (tab() === 'staff') { <app-staff /> } @else if (tab() === 'assignments') { <app-assignments /> } @else {
      @if (error()) { <div class="alert">{{ error() }}</div> }<section class="card section-card"><div class="panel-heading"><div><p class="eyebrow">SUBMITTED</p><h2>Request công chờ duyệt</h2><p class="muted">Chỉ Admin được approve/reject. Từ chối phải kèm lý do.</p></div><button class="secondary" type="button" (click)="loadQueue()">↻ Làm mới</button></div><div class="table-wrap"><table><thead><tr><th>Buổi</th><th>Nhân sự</th><th>Check-in</th><th>Check-out</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>@for(item of queue(); track item.id){<tr><td>{{ item.session?.session_date }} · {{ item.session?.class?.code }}</td><td>{{ item.staff?.code }} · {{ item.staff?.full_name }}</td><td><input class="compact-input" type="datetime-local" [value]="editValue(item.check_in_at)" (change)="setCheckIn(item, $event)" /></td><td><input class="compact-input" type="datetime-local" [value]="editValue(item.check_out_at)" (change)="setCheckOut(item, $event)" /></td><td><app-status-badge [value]="item.status" /></td><td class="inline-actions"><button class="primary" type="button" [disabled]="busyId() === item.id" (click)="review(item, 'APPROVED')">Duyệt</button><button class="secondary" type="button" [disabled]="busyId() === item.id" (click)="review(item, 'REJECTED')">Từ chối</button></td></tr>@if(rejectingId() === item.id){<tr><td colspan="6"><label>Lý do từ chối *<input [value]="rejectionReason" (input)="rejectionReason = $any($event.target).value" placeholder="Ví dụ: thiếu check-out hoặc sai giờ" /></label></td></tr>}}@empty{<tr><td colspan="6" class="empty">Không có request công đang chờ duyệt.</td></tr>}</tbody></table></div></section>
    }
  `,
})
export class PeopleHubComponent implements OnInit {
  readonly tab = signal<'staff' | 'assignments' | 'work-approval'>('staff');
  readonly queue = signal<WorkAttendance[]>([]);
  readonly error = signal('');
  readonly busyId = signal('');
  readonly rejectingId = signal('');
  rejectionReason = '';
  private readonly edited = new Map<string, { checkIn?: string; checkOut?: string }>();

  constructor(private readonly route: ActivatedRoute, private readonly workflow: WorkflowService, readonly period: PeriodContextService, private readonly toast: ToastService) {}
  ngOnInit(): void { this.route.queryParamMap.subscribe((params) => { const value = params.get('tab'); this.tab.set(value === 'assignments' || value === 'work-approval' ? value : 'staff'); if (this.tab() === 'work-approval') void this.loadQueue(); }); }
  async loadQueue(): Promise<void> { this.error.set(''); try { await this.period.ready; const p = this.period.current(); this.queue.set(p ? await this.workflow.workApprovalQueue(p.id) : []); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải request công.'); } }
  editValue(value: string | null | undefined): string { return value ? value.slice(0, 16) : ''; }
  setCheckIn(item: WorkAttendance, event: Event): void { const value = (event.target as HTMLInputElement).value; this.edited.set(item.id, { ...this.edited.get(item.id), checkIn: value }); }
  setCheckOut(item: WorkAttendance, event: Event): void { const value = (event.target as HTMLInputElement).value; this.edited.set(item.id, { ...this.edited.get(item.id), checkOut: value }); }
  async review(item: WorkAttendance, decision: 'APPROVED' | 'REJECTED'): Promise<void> { if (decision === 'REJECTED' && this.rejectingId() !== item.id) { this.rejectingId.set(item.id); this.rejectionReason = ''; return; } const edited = this.edited.get(item.id) ?? {}; if (decision === 'REJECTED' && !this.rejectionReason.trim()) { this.error.set('Cần nhập lý do từ chối.'); return; } this.busyId.set(item.id); try { await this.workflow.reviewWorkAttendance({ work_attendance_id: item.id, decision, check_in_at: edited.checkIn ? new Date(edited.checkIn).toISOString() : undefined, check_out_at: edited.checkOut ? new Date(edited.checkOut).toISOString() : undefined, rejection_reason: decision === 'REJECTED' ? this.rejectionReason.trim() : undefined }); this.toast.success(decision === 'APPROVED' ? 'Đã duyệt công.' : 'Đã từ chối request công.'); this.rejectingId.set(''); this.rejectionReason = ''; await this.loadQueue(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể duyệt công.'); } finally { this.busyId.set(''); } }
}
