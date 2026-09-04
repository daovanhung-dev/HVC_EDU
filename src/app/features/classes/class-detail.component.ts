import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { PeriodContextService } from '../../core/services/period-context.service';
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
    @if(editing&&auth.role()==='ADMIN'){<form class="card form-card" (ngSubmit)="save()"><h2>Chỉnh sửa lớp</h2><div class="form-grid"><label>Mã lớp *<input name="code" [(ngModel)]="form.code" required /></label><label>Tên lớp *<input name="name" [(ngModel)]="form.name" required /></label><label>Khối *<input name="grade" type="number" min="1" max="12" step="1" [(ngModel)]="form.grade" required /></label><label>Môn *<input name="subject" [(ngModel)]="form.subject" required /></label><label>Học phí/buổi *<input name="fee" type="number" min="0" step="1" [(ngModel)]="form.fee" required /></label><label>Cách thu<select name="method" [(ngModel)]="form.method"><option value="PER_SESSION">Theo buổi</option><option value="PREPAID">Thu trước</option></select></label><label>Trạng thái<select name="status" [(ngModel)]="form.status"><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label><label class="full">Ghi chú<textarea name="note" rows="2" [(ngModel)]="form.note"></textarea></label></div><div class="form-actions"><button class="primary">Lưu thay đổi</button><button type="button" class="secondary" (click)="startEdit()">Hủy</button></div></form>}
    <div class="grid-2"><section class="card section-card"><h2>Thông tin</h2><div class="stat-list"><div><span>Học phí</span><strong>{{money(item()?.standard_unit_fee)}}</strong></div><div><span>Cách thu</span><strong>{{item()?.collection_method === 'PREPAID' ? 'Thu trước' : 'Theo buổi'}}</strong></div><div><span>Trạng thái</span><strong>{{item()?.status}}</strong></div></div></section><section class="card section-card"><h2>Nhân sự phân công</h2>@for(a of assignments();track a.id){<div class="stat-list"><div><span>{{roleLabel(a.role)}}</span><strong>{{a.staff?.full_name || a.staff_id}} <small class="muted">({{a.staff?.code || '—'}})</small></strong></div></div>}@empty{<p class="muted">Chưa có phân công.</p>}</section></div>
    @if(financeVisible()){<section class="card section-card"><h2>Breakdown payroll kỳ hiện tại</h2><div class="table-wrap"><table><thead><tr><th>Nhân sự</th><th>Mã</th><th>Vai trò</th><th>Doanh thu lớp</th><th>Tỷ lệ</th><th>Lương cơ bản</th><th>Thưởng</th><th>Phạt</th><th>Thực nhận</th></tr></thead><tbody>@for(p of payroll();track p.id){<tr><td>{{p.staff?.full_name || p.staff_id}}</td><td>{{p.staff?.code || '—'}}</td><td>{{roleLabel(p.role)}}</td><td>{{money(p.class_revenue)}}</td><td>{{percent(p.applied_percent)}}%</td><td>{{money(p.base_amount)}}</td><td>{{money(p.bonus)}}</td><td>{{money(p.penalty)}}</td><td><strong>{{money(p.final_amount)}}</strong></td></tr>}@empty{<tr><td colspan="9" class="empty">Chưa có payroll cho kỳ hiện tại.</td></tr>}</tbody></table></div></section>}
    <section class="card section-card"><h2>Roster ({{enrollments().length}})</h2><div class="table-wrap"><table><thead><tr><th>Mã HS</th><th>Họ tên</th><th>Ngày vào</th><th>Đến ngày</th><th>Đơn giá riêng</th><th>Trạng thái</th>@if(auth.role()==='ADMIN'){<th>Thao tác</th>}</tr></thead><tbody>@for(e of enrollments();track e.id){<tr><td>{{e.student?.code}}</td><td>{{e.student?.full_name}}</td><td>{{e.enrolled_from}}</td><td>{{e.enrolled_to||'—'}}</td><td>{{e.unit_price_override !== null && e.unit_price_override !== undefined ? money(e.unit_price_override) : 'Theo lớp'}}</td><td>{{e.status==='ACTIVE'?'Đang học':'Đã rời lớp'}}</td>@if(auth.role()==='ADMIN'){<td>@if(e.status==='ACTIVE'){<input aria-label="Ngày rời lớp" type="date" [(ngModel)]="e.edit_enrolled_to" [name]="'enrolled_to_'+e.id" [min]="e.enrolled_from" /><button class="button-link" [disabled]="savingEnrollment()===e.id" (click)="leaveEnrollment(e)">{{savingEnrollment()===e.id?'Đang lưu…':'Cho nghỉ'}}</button>}@else{<span class="muted">Không mở lại</span>}</td>}</tr>}@empty{<tr><td [attr.colspan]="auth.role()==='ADMIN'?7:6" class="empty">Chưa có học sinh.</td></tr>}</tbody></table></div></section>
  `,
})
export class ClassDetailComponent implements OnInit {
  id = '';
  readonly item = signal<any>(null);
  readonly enrollments = signal<any[]>([]);
  readonly assignments = signal<any[]>([]);
  readonly payroll = signal<any[]>([]);
  readonly error = signal('');
  readonly savingEnrollment = signal('');
  editing = false;
  form = { code: '', name: '', grade: 1, subject: 'Toán', fee: 0, method: 'PER_SESSION', status: 'ACTIVE', note: '' };

  constructor(private readonly route: ActivatedRoute, private readonly supabase: SupabaseService, readonly auth: AuthService, readonly period: PeriodContextService, private readonly confirm: ConfirmService, private readonly toast: ToastService) {}

  ngOnInit() { this.id = this.route.snapshot.paramMap.get('id') || ''; void this.load(); }

  async load() {
    await this.period.ready;
    const result = await this.supabase.client.from('classes').select('*').eq('id', this.id).maybeSingle();
    if (result.error) this.error.set(this.friendlyError(result.error));
    else {
      this.item.set(result.data);
      if (!this.editing && result.data) this.form = { code: result.data.code, name: result.data.name, grade: result.data.grade, subject: result.data.subject, fee: result.data.standard_unit_fee, method: result.data.collection_method, status: result.data.status, note: result.data.note || '' };
    }
    const roster = await this.supabase.client.from('enrollments').select('id,enrolled_from,enrolled_to,unit_price_override,status,student:students(code,full_name)').eq('class_id', this.id).order('enrolled_from');
    if (!roster.error) this.enrollments.set((roster.data || []).map((row: any) => ({ ...row, edit_enrolled_to: row.enrolled_to || new Date().toISOString().slice(0, 10) })));
    const staff = await this.supabase.client.from('class_assignments').select('id,role,staff_id,staff:staff(code,full_name)').eq('class_id', this.id);
    if (!staff.error) this.assignments.set(staff.data || []);
    this.payroll.set([]);
    if (this.financeVisible()) {
      const period = this.period.current();
      if (period) {
        const run = await this.supabase.client.from('payroll_runs').select('id').eq('period_id', period.id).maybeSingle();
        if (run.error) this.error.set(this.friendlyError(run.error));
        else if (run.data) {
          const rows = await this.supabase.client.from('payroll_items').select('id,staff_id,role,class_revenue,applied_percent,base_amount,bonus,penalty,final_amount,staff:staff(code,full_name)').eq('payroll_run_id', run.data.id).eq('class_id', this.id);
          if (rows.error) this.error.set(this.friendlyError(rows.error)); else this.payroll.set(rows.data || []);
        }
      }
    }
  }

  startEdit() { this.editing = !this.editing; if (this.item() && this.editing) { const item = this.item(); this.form = { code: item.code, name: item.name, grade: item.grade, subject: item.subject, fee: item.standard_unit_fee, method: item.collection_method, status: item.status, note: item.note || '' }; } }

  async save() {
    const grade = Number(this.form.grade);
    const fee = Number(this.form.fee);
    if (!this.form.code.trim() || !this.form.name.trim() || !this.form.subject.trim() || !Number.isSafeInteger(grade) || grade < 1 || grade > 12 || !Number.isSafeInteger(fee) || fee < 0) { this.error.set('Mã, tên, môn, khối 1–12 và học phí phải hợp lệ; học phí là số nguyên VND.'); return; }
    if (this.form.status === 'INACTIVE' && !this.confirm.ask('Ngừng hoạt động lớp này? Lịch sử tài chính và học tập vẫn được giữ.')) return;
    const result = await this.supabase.client.rpc('rpc_update_class', { p_class_id: this.id, p_code: this.form.code.trim(), p_name: this.form.name.trim(), p_grade: grade, p_subject: this.form.subject.trim(), p_standard_unit_fee: fee, p_collection_method: this.form.method, p_status: this.form.status, p_note: this.form.note.trim() || null });
    if (result.error) this.error.set(this.friendlyError(result.error)); else { this.toast.success('Đã cập nhật lớp.'); this.editing = false; await this.load(); }
  }

  async leaveEnrollment(enrollment: any) {
    const enrolledTo = String(enrollment.edit_enrolled_to || '').trim();
    if (!enrolledTo || enrolledTo < enrollment.enrolled_from) { this.error.set('Ngày rời lớp phải từ ngày bắt đầu học trở đi.'); return; }
    if (!this.confirm.ask(`Cho học sinh ${enrollment.student?.full_name || ''} rời lớp? Lịch sử điểm danh, đánh giá và học phí vẫn được giữ.`)) return;
    this.savingEnrollment.set(enrollment.id);
    const result = await this.supabase.client.rpc('rpc_update_enrollment_status', { p_enrollment_id: enrollment.id, p_status: 'LEFT', p_enrolled_to: enrolledTo });
    this.savingEnrollment.set('');
    if (result.error) this.error.set(this.friendlyError(result.error)); else { this.toast.success('Đã cập nhật trạng thái học sinh.'); await this.load(); }
  }

  financeVisible() { return ['ADMIN', 'ACCOUNTANT'].includes(this.auth.role() || ''); }
  roleLabel(role: string) { return role === 'MAIN_TEACHER' ? 'Giáo viên chính' : 'Trợ giảng'; }
  percent(value: unknown) { return (Number(value || 0) * 100).toFixed(2); }
  money(value: unknown) { return formatMoney(Number(value || 0)); }
  private friendlyError(error: any) {
    const message = String(error?.message || error || '');
    if (message.includes('CONFLICT') || message.includes('duplicate key')) return 'Mã lớp đã tồn tại trong trung tâm.';
    if (message.includes('ENROLLMENT_REJOIN_REQUIRED')) return 'Enrollment đã kết thúc; hãy tạo enrollment mới để học sinh quay lại lớp.';
    return message || 'Không thể hoàn tất thao tác.';
  }
}
