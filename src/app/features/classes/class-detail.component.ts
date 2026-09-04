import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { formatMoney } from '../../core/utils/money.util';

@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-header"><div><p class="eyebrow">LỚP HỌC</p><h1>{{ item()?.name || 'Chi tiết lớp' }}</h1><p class="muted">{{ item()?.code }} · Khối {{ item()?.grade }} · {{ item()?.subject }}</p></div><div><a class="secondary" [routerLink]="['/classes', id, 'schedule']">Lịch học</a><a class="secondary" routerLink="/classes">Danh sách</a>@if(auth.role()==='ADMIN'){<button class="primary" (click)="startEdit()">{{editing?'Đóng sửa':'Sửa lớp'}}</button>}</div></section>
    @if(error()){<div class="alert">{{error()}}</div>}
    @if(editing&&auth.role()==='ADMIN'){<form class="card form-card" (ngSubmit)="save()"><h2>Chỉnh sửa lớp</h2><div class="form-grid"><label>Mã lớp *<input name="code" [(ngModel)]="form.code" required /></label><label>Tên lớp *<input name="name" [(ngModel)]="form.name" required /></label><label>Khối *<input name="grade" type="number" min="1" max="12" [(ngModel)]="form.grade" required /></label><label>Môn *<input name="subject" [(ngModel)]="form.subject" required /></label><label>Học phí/buổi *<input name="fee" type="number" min="0" step="1" [(ngModel)]="form.fee" required /></label><label>Cách thu<select name="method" [(ngModel)]="form.method"><option value="PER_SESSION">Theo buổi</option><option value="PREPAID">Thu trước</option></select></label><label>Trạng thái<select name="status" [(ngModel)]="form.status"><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label><label class="full">Ghi chú<textarea name="note" rows="2" [(ngModel)]="form.note"></textarea></label></div><div class="form-actions"><button class="primary">Lưu thay đổi</button><button type="button" class="secondary" (click)="startEdit()">Hủy</button></div></form>}
    <div class="grid-2"><section class="card section-card"><h2>Thông tin</h2><div class="stat-list"><div><span>Học phí</span><strong>{{money(item()?.standard_unit_fee)}}</strong></div><div><span>Cách thu</span><strong>{{item()?.collection_method === 'PREPAID' ? 'Thu trước' : 'Theo buổi'}}</strong></div><div><span>Trạng thái</span><strong>{{item()?.status}}</strong></div></div></section><section class="card section-card"><h2>Nhân sự phân công</h2>@for(a of assignments();track a.id){<div class="stat-list"><div><span>{{a.role}}</span><strong>{{a.staff?.full_name || a.staff_id}}</strong></div></div>}@empty{<p class="muted">Chưa có phân công.</p>}</section></div>
    <section class="card section-card"><h2>Roster ({{enrollments().length}})</h2><div class="table-wrap"><table><thead><tr><th>Mã HS</th><th>Họ tên</th><th>Ngày vào</th><th>Đơn giá riêng</th><th>Trạng thái</th></tr></thead><tbody>@for(e of enrollments();track e.id){<tr><td>{{e.student?.code}}</td><td>{{e.student?.full_name}}</td><td>{{e.enrolled_from}}</td><td>{{e.unit_price_override ? money(e.unit_price_override) : 'Theo lớp'}}</td><td>{{e.status}}</td></tr>}@empty{<tr><td colspan="5" class="empty">Chưa có học sinh.</td></tr>}</tbody></table></div></section>
  `,
})
export class ClassDetailComponent implements OnInit {
  id = '';
  readonly item = signal<any>(null);
  readonly enrollments = signal<any[]>([]);
  readonly assignments = signal<any[]>([]);
  readonly error = signal('');
  editing = false;
  form = { code: '', name: '', grade: 1, subject: 'Toán', fee: 0, method: 'PER_SESSION', status: 'ACTIVE', note: '' };

  constructor(private readonly route: ActivatedRoute, private readonly supabase: SupabaseService, readonly auth: AuthService, private readonly confirm: ConfirmService, private readonly toast: ToastService) {}

  ngOnInit() { this.id = this.route.snapshot.paramMap.get('id') || ''; void this.load(); }

  async load() {
    const result = await this.supabase.client.from('classes').select('*').eq('id', this.id).maybeSingle();
    if (result.error) this.error.set(result.error.message); else { this.item.set(result.data); if (!this.editing && result.data) this.form = { code: result.data.code, name: result.data.name, grade: result.data.grade, subject: result.data.subject, fee: result.data.standard_unit_fee, method: result.data.collection_method, status: result.data.status, note: result.data.note || '' }; }
    const roster = await this.supabase.client.from('enrollments').select('id,enrolled_from,unit_price_override,status,student:students(code,full_name)').eq('class_id', this.id).order('enrolled_from');
    if (!roster.error) this.enrollments.set(roster.data || []);
    const staff = await this.supabase.client.from('class_assignments').select('id,role,staff_id,staff:staff(full_name)').eq('class_id', this.id);
    if (!staff.error) this.assignments.set(staff.data || []);
  }

  startEdit() { this.editing = !this.editing; if (this.item() && this.editing) { const item = this.item(); this.form = { code: item.code, name: item.name, grade: item.grade, subject: item.subject, fee: item.standard_unit_fee, method: item.collection_method, status: item.status, note: item.note || '' }; } }

  async save() {
    if (!Number.isSafeInteger(Number(this.form.fee)) || Number(this.form.fee) < 0 || !this.form.code.trim() || !this.form.name.trim() || !this.form.subject.trim()) { this.error.set('Vui lòng kiểm tra các trường bắt buộc.'); return; }
    if (this.form.status === 'INACTIVE' && !this.confirm.ask('Ngừng hoạt động lớp này? Lịch sử tài chính và học tập vẫn được giữ.')) return;
    const result = await this.supabase.client.rpc('rpc_update_class', { p_class_id: this.id, p_code: this.form.code.trim(), p_name: this.form.name.trim(), p_grade: this.form.grade, p_subject: this.form.subject.trim(), p_standard_unit_fee: Number(this.form.fee), p_collection_method: this.form.method, p_status: this.form.status, p_note: this.form.note.trim() || null });
    if (result.error) this.error.set(result.error.message); else { this.toast.success('Đã cập nhật lớp.'); this.editing = false; await this.load(); }
  }

  money(value: unknown) { return formatMoney(Number(value || 0)); }
}
