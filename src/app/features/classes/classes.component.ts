import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CenterClass, MinimalService } from '../../core/services/minimal.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type ClassForm = { id: string | null; code: string; name: string; grade: number; subject: string; note: string };
const blankForm = (): ClassForm => ({ id: null, code: '', name: '', grade: 1, subject: '', note: '' });

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">LỚP HỌC</p><h2>Danh sách lớp</h2><p class="muted">Chọn một lớp để quản lý roster, lịch tuần và buổi học.</p></div>@if (auth.role() === 'ADMIN') { <button class="primary" type="button" (click)="startCreate()">+ Thêm lớp</button> }</section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    @if (auth.role() === 'ADMIN' && editing()) { <form class="card form-card section-heading-spaced" (ngSubmit)="save()"><div class="panel-heading"><div><p class="eyebrow">{{ form.id ? 'SỬA LỚP' : 'THÊM LỚP' }}</p><h3>Thông tin lớp</h3></div><button class="secondary" type="button" (click)="editing.set(false)">Đóng</button></div><div class="form-grid"><label>Mã lớp<input name="code" [(ngModel)]="form.code" required /></label><label>Tên lớp<input name="name" [(ngModel)]="form.name" required /></label><label>Khối<input name="grade" type="number" min="1" max="12" [(ngModel)]="form.grade" required /></label><label>Môn học<input name="subject" [(ngModel)]="form.subject" required /></label><label class="span-2">Ghi chú<textarea name="note" rows="2" [(ngModel)]="form.note"></textarea></label></div><div class="form-actions"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Đang lưu…' : 'Lưu lớp' }}</button></div></form> }
    <div class="toolbar"><label>Tìm kiếm<input [(ngModel)]="search" placeholder="Mã hoặc tên lớp" /></label><label>Trạng thái<select [(ngModel)]="statusFilter" (ngModelChange)="load()"><option value="ACTIVE">Đang hoạt động</option><option value="ALL">Tất cả</option></select></label><button class="secondary" type="button" [disabled]="loading()" (click)="load()">Làm mới</button></div>
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải lớp…</span></section> } @else { <div class="card table-wrap"><table><thead><tr><th>Mã</th><th>Tên lớp</th><th>Khối</th><th>Môn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>@for (item of filtered(); track item.id) { <tr><td><a class="button-link" [routerLink]="['/classes', item.id]">{{ item.code }}</a></td><td>{{ item.name }}</td><td>{{ item.grade }}</td><td>{{ item.subject }}</td><td><app-status-badge [value]="item.status" /></td><td class="table-actions">@if (auth.role() === 'ADMIN') { <button class="button-link link-button" type="button" (click)="startEdit(item)">Sửa</button>@if (item.status === 'ACTIVE') { <button class="button-link link-button danger-text" type="button" (click)="deactivate(item)">Ngừng</button> } }</td></tr> } @empty { <tr><td colspan="6" class="empty">Chưa có lớp phù hợp.</td></tr> }</tbody></table></div> }
  `,
})
export class ClassesComponent implements OnInit {
  readonly items = signal<CenterClass[]>([]); readonly loading = signal(true); readonly error = signal(''); readonly editing = signal(false);
  search = ''; statusFilter = 'ACTIVE'; form = blankForm(); saving = false;
  constructor(readonly auth: AuthService, private readonly minimal: MinimalService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { this.items.set(await this.minimal.listClasses(this.statusFilter === 'ALL')); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải lớp.'); } finally { this.loading.set(false); } }
  filtered(): CenterClass[] { const needle = this.search.trim().toLowerCase(); return this.items().filter((item) => !needle || `${item.code} ${item.name} ${item.subject}`.toLowerCase().includes(needle)); }
  startCreate(): void { this.form = blankForm(); this.editing.set(true); }
  startEdit(item: CenterClass): void { this.form = { id: item.id, code: item.code, name: item.name, grade: item.grade, subject: item.subject, note: item.note || '' }; this.editing.set(true); }
  async save(): Promise<void> { this.saving = true; this.error.set(''); try { await this.minimal.upsertClass({ class_id: this.form.id, code: this.form.code, name: this.form.name, grade: Number(this.form.grade), subject: this.form.subject, note: this.form.note || null, status: 'ACTIVE' }); this.editing.set(false); await this.load(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu lớp.'); } finally { this.saving = false; } }
  async deactivate(item: CenterClass): Promise<void> { if (!confirm(`Ngừng hoạt động lớp ${item.code}?`)) return; try { await this.minimal.deactivate('classes', item.id); await this.load(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể ngừng lớp.'); } }
}
