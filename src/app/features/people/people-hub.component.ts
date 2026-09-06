import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { MinimalService, Staff, StaffType } from '../../core/services/minimal.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type StaffForm = { id: string | null; code: string; full_name: string; staff_type: StaffType; phone: string; email: string; note: string };
const blankForm = (): StaffForm => ({ id: null, code: '', full_name: '', staff_type: 'TEACHER', phone: '', email: '', note: '' });

@Component({
  selector: 'app-people-hub',
  standalone: true,
  imports: [FormsModule, StatusBadgeComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">NHÂN SỰ</p><h1>Quản lý nhân sự</h1><p class="page-description muted">Thêm, sửa, ngừng hoạt động và mời tài khoản Staff.</p></div><button class="primary" type="button" (click)="startCreate()">+ Thêm nhân sự</button></section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    @if (editing()) { <form class="card form-card" (ngSubmit)="save()"><div class="panel-heading"><div><p class="eyebrow">{{ form.id ? 'SỬA NHÂN SỰ' : 'THÊM NHÂN SỰ' }}</p><h2>Thông tin nhân sự</h2></div><button class="secondary" type="button" (click)="editing.set(false)">Đóng</button></div><div class="form-grid"><label>Mã nhân sự<input name="code" [(ngModel)]="form.code" required /></label><label>Họ và tên<input name="full_name" [(ngModel)]="form.full_name" required /></label><label>Loại<select name="staff_type" [(ngModel)]="form.staff_type"><option value="TEACHER">Giáo viên</option><option value="ASSISTANT">Trợ giảng</option></select></label><label>Số điện thoại<input name="phone" [(ngModel)]="form.phone" /></label><label>Email tài khoản<input type="email" name="email" [(ngModel)]="form.email" /></label><label class="span-2">Ghi chú<textarea name="note" rows="2" [(ngModel)]="form.note"></textarea></label></div><div class="form-actions"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Đang lưu…' : 'Lưu nhân sự' }}</button></div></form> }
    @if (inviteTarget()) { <form class="card form-card section-heading-spaced" (ngSubmit)="invite()"><div class="panel-heading"><div><p class="eyebrow">TÀI KHOẢN STAFF</p><h2>Mời {{ inviteTarget()!.full_name }}</h2></div><button class="secondary" type="button" (click)="inviteTarget.set(null)">Đóng</button></div><label>Email nhận lời mời<input type="email" name="invite_email" [(ngModel)]="inviteEmail" required /></label><div class="form-actions"><button class="primary" type="submit" [disabled]="inviting">{{ inviting ? 'Đang gửi…' : 'Gửi lời mời' }}</button></div></form> }
    <div class="toolbar"><label>Tìm kiếm<input [(ngModel)]="search" placeholder="Mã hoặc tên nhân sự" /></label><label>Trạng thái<select [(ngModel)]="statusFilter" (ngModelChange)="load()"><option value="ACTIVE">Đang hoạt động</option><option value="ALL">Tất cả</option></select></label><button class="secondary" type="button" (click)="load()">Làm mới</button></div>
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải nhân sự…</span></section> } @else { <div class="card table-wrap"><table><thead><tr><th>Mã</th><th>Họ tên</th><th>Loại</th><th>Liên hệ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>@for (item of filtered(); track item.id) { <tr><td>{{ item.code }}</td><td>{{ item.full_name }}</td><td>{{ item.staff_type === 'TEACHER' ? 'Giáo viên' : 'Trợ giảng' }}</td><td>{{ item.email || item.phone || '—' }}</td><td><app-status-badge [value]="item.status" /></td><td class="table-actions"><button class="button-link link-button" type="button" (click)="startEdit(item)">Sửa</button>@if (item.status === 'ACTIVE') { <button class="button-link link-button" type="button" (click)="deactivate(item)">Ngừng</button><button class="button-link link-button" type="button" (click)="startInvite(item)">Mời tài khoản</button> }</td></tr> } @empty { <tr><td colspan="6" class="empty">Chưa có nhân sự phù hợp.</td></tr> }</tbody></table></div> }
  `,
})
export class PeopleHubComponent implements OnInit {
  readonly items = signal<Staff[]>([]); readonly loading = signal(true); readonly error = signal(''); readonly editing = signal(false); readonly inviteTarget = signal<Staff | null>(null);
  search = ''; statusFilter = 'ACTIVE'; form = blankForm(); inviteEmail = ''; saving = false; inviting = false;
  constructor(private readonly minimal: MinimalService, private readonly toast: ToastService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { this.items.set(await this.minimal.listStaff(this.statusFilter === 'ALL')); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải nhân sự.'); } finally { this.loading.set(false); } }
  filtered(): Staff[] { const needle = this.search.trim().toLowerCase(); return this.items().filter((item) => !needle || `${item.code} ${item.full_name} ${item.email || ''}`.toLowerCase().includes(needle)); }
  startCreate(): void { this.form = blankForm(); this.editing.set(true); this.inviteTarget.set(null); }
  startEdit(item: Staff): void { this.form = { id: item.id, code: item.code, full_name: item.full_name, staff_type: item.staff_type, phone: item.phone || '', email: item.email || '', note: item.note || '' }; this.editing.set(true); }
  async save(): Promise<void> { this.saving = true; this.error.set(''); try { await this.minimal.upsertStaff({ staff_id: this.form.id, code: this.form.code, full_name: this.form.full_name, staff_type: this.form.staff_type, phone: this.form.phone || null, email: this.form.email || null, note: this.form.note || null, status: 'ACTIVE' }); this.toast.success('Đã lưu nhân sự.'); this.editing.set(false); await this.load(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu nhân sự.'); } finally { this.saving = false; } }
  startInvite(item: Staff): void { this.inviteTarget.set(item); this.inviteEmail = item.email || ''; }
  async invite(): Promise<void> { const target = this.inviteTarget(); if (!target) return; this.inviting = true; this.error.set(''); try { await this.minimal.inviteStaff(target.id, this.inviteEmail); this.toast.success('Đã gửi lời mời tài khoản Staff.'); this.inviteTarget.set(null); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể gửi lời mời.'); } finally { this.inviting = false; } }
  async deactivate(item: Staff): Promise<void> { if (!confirm(`Ngừng hoạt động nhân sự ${item.code}? Lịch sử chấm công vẫn được giữ.`)) return; try { await this.minimal.deactivate('staff', item.id); await this.load(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể ngừng nhân sự.'); } }
}
