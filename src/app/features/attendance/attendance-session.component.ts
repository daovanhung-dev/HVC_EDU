import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AttendanceRow, ClassSession, MinimalService } from '../../core/services/minimal.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-attendance-session',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải điểm danh…</span></section> } @else if (error()) { <div class="alert">{{ error() }}</div> } @else if (session()) { <section class="page-header"><div><p class="eyebrow">ĐIỂM DANH</p><h1>{{ session()!.class?.name || 'Buổi học' }}</h1><p class="muted">{{ session()!.session_date }} · {{ session()!.start_time || 'Chưa đặt giờ' }}</p></div><a class="secondary" [routerLink]="['/classes', classId]">Về lớp</a></section><section class="card section-card"><div class="panel-heading"><div><h2>Danh sách học sinh</h2><p class="muted">{{ count('PRESENT') }} có mặt · {{ count('ABSENT') }} vắng · {{ count('EXCUSED') }} có phép</p></div><div class="form-actions"><button class="secondary" type="button" (click)="markAll('PRESENT')">Tất cả có mặt</button><button class="primary" type="button" [disabled]="saving" (click)="save()">{{ saving ? 'Đang lưu…' : 'Lưu điểm danh' }}</button></div></div><div class="table-wrap"><table><thead><tr><th>Mã HS</th><th>Họ tên</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>@for (row of rows(); track row.enrollment_id) { <tr><td>{{ row.student.code }}</td><td>{{ row.student.full_name }}</td><td><select [name]="'status_' + row.enrollment_id" [(ngModel)]="row.status"><option value="PRESENT">Có mặt</option><option value="ABSENT">Vắng</option><option value="EXCUSED">Có phép</option></select></td><td><input [name]="'note_' + row.enrollment_id" [(ngModel)]="row.note" placeholder="Ghi chú" /></td></tr> } @empty { <tr><td colspan="4" class="empty">Không có học sinh active tại buổi này.</td></tr> }</tbody></table></div></section> }
  `,
})
export class AttendanceSessionComponent implements OnInit {
  readonly session = signal<ClassSession | null>(null); readonly rows = signal<AttendanceRow[]>([]); readonly loading = signal(true); readonly error = signal(''); saving = false; classId = ''; sessionId = '';
  constructor(private readonly route: ActivatedRoute, private readonly minimal: MinimalService, private readonly toast: ToastService) {}
  ngOnInit(): void { this.classId = this.route.snapshot.paramMap.get('classId') || ''; this.sessionId = this.route.snapshot.paramMap.get('sessionId') || ''; void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { const data = await this.minimal.sessionRoster(this.sessionId); this.session.set(data.session); this.rows.set(data.attendance); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải điểm danh.'); } finally { this.loading.set(false); } }
  count(status: string): number { return this.rows().filter((row) => row.status === status).length; }
  markAll(status: AttendanceRow['status']): void { this.rows.update((rows) => rows.map((row) => ({ ...row, status }))); }
  async save(): Promise<void> { this.saving = true; try { await this.minimal.saveAttendance(this.sessionId, this.rows()); this.toast.success('Đã lưu điểm danh.'); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu điểm danh.'); } finally { this.saving = false; } }
}
