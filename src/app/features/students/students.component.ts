import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { CenterClass, MinimalService, Student } from '../../core/services/minimal.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type StudentForm = { id: string | null; code: string; full_name: string; phone: string; parent_name: string; parent_phone: string; note: string; class_id: string };
const blankForm = (): StudentForm => ({ id: null, code: '', full_name: '', phone: '', parent_name: '', parent_phone: '', note: '', class_id: '' });

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [FormsModule, StatusBadgeComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">HỌC SINH</p><h2>Danh sách học sinh</h2><p class="muted">Thông tin liên hệ và lớp đang theo học.</p></div>@if (auth.role() === 'ADMIN') { <button class="primary" type="button" (click)="startCreate()">+ Thêm học sinh</button> }</section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    @if (auth.role() === 'ADMIN' && editing()) { <form class="card form-card section-heading-spaced" (ngSubmit)="save()"><div class="panel-heading"><div><p class="eyebrow">{{ form.id ? 'SỬA HỌC SINH' : 'THÊM HỌC SINH' }}</p><h3>Thông tin học sinh</h3></div><button class="secondary" type="button" (click)="editing.set(false)">Đóng</button></div><div class="form-grid"><label>Mã học sinh<input name="code" [(ngModel)]="form.code" required /></label><label>Họ và tên<input name="full_name" [(ngModel)]="form.full_name" required /></label><label>Số điện thoại<input name="phone" [(ngModel)]="form.phone" /></label><label>Phụ huynh<input name="parent_name" [(ngModel)]="form.parent_name" /></label><label>SĐT phụ huynh<input name="parent_phone" [(ngModel)]="form.parent_phone" /></label><label>Lớp hiện tại<select name="class_id" [(ngModel)]="form.class_id"><option value="">Chưa xếp lớp</option>@for (item of classes(); track item.id) { <option [value]="item.id">{{ item.code }} · {{ item.name }}</option> }</select></label><label class="span-2">Ghi chú<textarea name="note" rows="2" [(ngModel)]="form.note"></textarea></label></div><div class="form-actions"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Đang lưu…' : 'Lưu học sinh' }}</button></div></form> }
    <div class="toolbar"><label>Tìm kiếm<input [(ngModel)]="search" placeholder="Mã hoặc tên học sinh" /></label><label>Trạng thái<select [(ngModel)]="statusFilter" (ngModelChange)="load()"><option value="ACTIVE">Đang hoạt động</option><option value="ALL">Tất cả</option></select></label><button class="secondary" type="button" [disabled]="loading()" (click)="load()">Làm mới</button></div>
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải học sinh…</span></section> } @else { <div class="card table-wrap"><table><thead><tr><th>Mã</th><th>Họ và tên</th><th>Lớp hiện tại</th><th>Liên hệ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>@for (item of filtered(); track item.id) { <tr><td>{{ item.code }}</td><td>{{ item.full_name }}</td><td>{{ currentClass(item) }}</td><td>{{ item.parent_phone || item.phone || '—' }}</td><td><app-status-badge [value]="item.status" /></td><td class="table-actions">@if (auth.role() === 'ADMIN') { <button class="button-link link-button" type="button" (click)="startEdit(item)">Sửa</button>@if (item.status === 'ACTIVE') { <button class="button-link link-button danger-text" type="button" (click)="deactivate(item)">Ngừng</button> } }</td></tr> } @empty { <tr><td colspan="6" class="empty">Chưa có học sinh phù hợp.</td></tr> }</tbody></table></div> }
  `,
})
export class StudentsComponent implements OnInit {
  readonly items = signal<Student[]>([]); readonly classes = signal<CenterClass[]>([]); readonly loading = signal(true); readonly error = signal(''); readonly editing = signal(false);
  search = ''; statusFilter = 'ACTIVE'; form = blankForm(); saving = false;
  constructor(readonly auth: AuthService, private readonly minimal: MinimalService) {}
  ngOnInit(): void { void this.load(); void this.loadClasses(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { this.items.set(await this.minimal.listStudents(this.statusFilter === 'ALL')); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải học sinh.'); } finally { this.loading.set(false); } }
  async loadClasses(): Promise<void> { try { this.classes.set(await this.minimal.listClasses()); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải lớp.'); } }
  filtered(): Student[] { const needle = this.search.trim().toLowerCase(); return this.items().filter((item) => !needle || `${item.code} ${item.full_name}`.toLowerCase().includes(needle)); }
  currentEnrollment(item: Student) { return item.enrollments?.find((enrollment) => enrollment.status === 'ACTIVE') ?? null; }
  currentClass(item: Student): string { const enrollment = this.currentEnrollment(item); return enrollment?.class ? `${enrollment.class.code} · ${enrollment.class.name}` : 'Chưa xếp lớp'; }
  startCreate(): void { this.form = blankForm(); this.editing.set(true); }
  startEdit(item: Student): void { const enrollment = this.currentEnrollment(item); this.form = { id: item.id, code: item.code, full_name: item.full_name, phone: item.phone || '', parent_name: item.parent_name || '', parent_phone: item.parent_phone || '', note: item.note || '', class_id: enrollment?.class_id || '' }; this.editing.set(true); }
  async save(): Promise<void> {
    this.saving = true; this.error.set('');
    try {
      const saved = await this.minimal.upsertStudent({ student_id: this.form.id, code: this.form.code, full_name: this.form.full_name, phone: this.form.phone || null, parent_name: this.form.parent_name || null, parent_phone: this.form.parent_phone || null, note: this.form.note || null, status: 'ACTIVE' });
      const previous = this.form.id ? this.items().find((item) => item.id === this.form.id) : undefined;
      const previousEnrollment = previous ? this.currentEnrollment(previous) : null;
      if (this.form.class_id && (!previousEnrollment || previousEnrollment.class_id !== this.form.class_id)) {
        if (previousEnrollment) await this.minimal.upsertEnrollment({ enrollment_id: previousEnrollment.id, student_id: saved.id, class_id: previousEnrollment.class_id, enrolled_from: previousEnrollment.enrolled_from, enrolled_to: MinimalService.iso(new Date()), status: 'LEFT' });
        await this.minimal.upsertEnrollment({ enrollment_id: null, student_id: saved.id, class_id: this.form.class_id, enrolled_from: MinimalService.iso(new Date()), enrolled_to: null, status: 'ACTIVE' });
      }
      this.editing.set(false); await this.load();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu học sinh.'); }
    finally { this.saving = false; }
  }
  async deactivate(item: Student): Promise<void> { if (!confirm(`Ngừng hoạt động học sinh ${item.code}?`)) return; try { await this.minimal.deactivate('students', item.id); await this.load(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể ngừng học sinh.'); } }
}
