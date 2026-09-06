import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MinimalService, Staff, StaffAttendance, StaffAttendanceStatus } from '../../core/services/minimal.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-staff-attendance',
  standalone: true,
  imports: [FormsModule, StatusBadgeComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">NHÂN SỰ</p><h1>Chấm công theo ngày</h1><p class="page-description muted">Bản ghi được lưu chính thức ngay khi gửi, không cần bước duyệt.</p></div></section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    <form class="card form-card" (ngSubmit)="save()"><div class="form-grid"><label>Ngày<input type="date" name="date" [(ngModel)]="attendanceDate" required /></label>@if (auth.role() === 'ADMIN') { <label>Nhân sự<select name="staff_id" [(ngModel)]="selectedStaffId" required><option value="">Chọn nhân sự</option>@for (staff of staffList(); track staff.id) { <option [value]="staff.id">{{ staff.code }} · {{ staff.full_name }}</option> }</select></label> }<label>Trạng thái<select name="status" [(ngModel)]="status"><option value="PRESENT">Có mặt</option><option value="ABSENT">Vắng</option><option value="LEAVE">Nghỉ phép</option></select></label><label>Ghi chú<input name="note" [(ngModel)]="note" placeholder="Không bắt buộc" /></label></div><div class="form-actions"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Đang lưu…' : 'Lưu chấm công' }}</button></div></form>
    <div class="toolbar"><label>Từ ngày<input type="date" [(ngModel)]="fromDate" /></label><label>Đến ngày<input type="date" [(ngModel)]="toDate" /></label>@if (auth.role() === 'ADMIN') { <label>Lọc nhân sự<select [(ngModel)]="filterStaffId"><option value="">Tất cả</option>@for (staff of staffList(); track staff.id) { <option [value]="staff.id">{{ staff.code }} · {{ staff.full_name }}</option> }</select></label> }<button class="secondary" type="button" (click)="loadRecords()">Xem</button></div>
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải chấm công…</span></section> } @else { <div class="card table-wrap"><table><thead><tr><th>Ngày</th><th>Nhân sự</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>@for (item of records(); track item.id) { <tr><td>{{ item.attendance_date }}</td><td>{{ item.staff?.code }} · {{ item.staff?.full_name }}</td><td><app-status-badge [value]="item.status" /></td><td>{{ item.note || '—' }}</td></tr> } @empty { <tr><td colspan="4" class="empty">Chưa có bản ghi trong khoảng ngày.</td></tr> }</tbody></table></div> }
  `,
})
export class StaffAttendanceComponent implements OnInit {
  readonly records = signal<StaffAttendance[]>([]); readonly staffList = signal<Staff[]>([]); readonly loading = signal(true); readonly error = signal(''); saving = false;
  attendanceDate = MinimalService.iso(new Date()); fromDate = MinimalService.currentMonth().from; toDate = MinimalService.currentMonth().to; selectedStaffId = ''; filterStaffId = ''; status: StaffAttendanceStatus = 'PRESENT'; note = '';
  constructor(readonly auth: AuthService, private readonly minimal: MinimalService, private readonly toast: ToastService) {}
  ngOnInit(): void { void this.loadStaff(); void this.loadRecords(); }
  async loadStaff(): Promise<void> { try { const staff = await this.minimal.listStaff(); this.staffList.set(staff); if (this.auth.role() !== 'ADMIN') this.selectedStaffId = this.auth.profile()?.staff_id || ''; } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải nhân sự.'); } }
  async loadRecords(): Promise<void> { this.loading.set(true); try { const id = this.auth.role() === 'ADMIN' ? this.filterStaffId || undefined : this.auth.profile()?.staff_id || undefined; this.records.set(await this.minimal.listStaffAttendance(this.fromDate, this.toDate, id)); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải chấm công.'); } finally { this.loading.set(false); } }
  async save(): Promise<void> { this.saving = true; try { await this.minimal.saveStaffAttendance({ staff_id: this.auth.role() === 'ADMIN' ? this.selectedStaffId : undefined, attendance_date: this.attendanceDate, status: this.status, note: this.note || null }); this.toast.success('Đã lưu chấm công.'); this.note = ''; await this.loadRecords(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu chấm công.'); } finally { this.saving = false; } }
}
