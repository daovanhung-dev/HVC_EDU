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
  selector: 'app-student-detail',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-header"><div><p class="eyebrow">HỌC SINH</p><h1>{{student()?.full_name||'Hồ sơ học sinh'}}</h1><p class="muted">{{student()?.code}} · {{student()?.parent_phone||'Chưa có SĐT phụ huynh'}}</p></div><div><a class="secondary" routerLink="/students">Danh sách</a>@if(auth.role()==='ADMIN'){<button class="primary" (click)="startEdit()">{{editing?'Đóng sửa':'Sửa hồ sơ'}}</button>}</div></section>
    @if(error()){<div class="alert">{{error()}}</div>}
    @if(editing&&auth.role()==='ADMIN'){<form class="card form-card" (ngSubmit)="save()"><h2>Chỉnh sửa hồ sơ</h2><div class="form-grid"><label>Mã HS *<input name="code" [(ngModel)]="form.code" required /></label><label>Họ tên *<input name="full_name" [(ngModel)]="form.full_name" required /></label><label>SĐT học sinh<input name="phone" [(ngModel)]="form.phone" /></label><label>Tên phụ huynh<input name="parent_name" [(ngModel)]="form.parent_name" /></label><label>SĐT phụ huynh<input name="parent_phone" [(ngModel)]="form.parent_phone" /></label><label>Trạng thái<select name="status" [(ngModel)]="form.status"><option value="ACTIVE">Đang học</option><option value="INACTIVE">Tạm dừng</option></select></label><label class="full">Ghi chú<textarea name="note" rows="2" [(ngModel)]="form.note"></textarea></label></div><div class="form-actions"><button class="primary">Lưu thay đổi</button><button type="button" class="secondary" (click)="startEdit()">Hủy</button></div></form>}
    <div class="grid-2"><section class="card section-card"><h2>Thông tin</h2><div class="stat-list"><div><span>Phụ huynh</span><strong>{{student()?.parent_name||'—'}}</strong></div><div><span>Điện thoại</span><strong>{{student()?.phone||'—'}}</strong></div><div><span>Trạng thái</span><strong>{{student()?.status}}</strong></div></div></section>@if(financeVisible()){<section class="card section-card"><h2>Học phí</h2><div class="stat-list">@for(l of ledgers();track l.id){<div><span>{{l.period_id}}</span><strong>{{money(l.debt_amount)}} nợ</strong></div>}@empty{<p class="muted">Chưa có ledger.</p>}</div></section>}</div>
    <section class="card section-card"><h2>Lớp học & lịch sử xếp lớp</h2><div class="table-wrap"><table><thead><tr><th>Lớp</th><th>Từ ngày</th><th>Đến ngày</th><th>Đơn giá</th><th>Trạng thái</th>@if(auth.role()==='ADMIN'){<th>Thao tác</th>}</tr></thead><tbody>@for(e of enrollments();track e.id){<tr><td>{{e.class?.code}} · {{e.class?.name}}</td><td>{{e.enrolled_from}}</td><td>{{e.enrolled_to||'—'}}</td><td>{{e.unit_price_override !== null && e.unit_price_override !== undefined?money(e.unit_price_override):'Theo lớp'}}</td><td>{{e.status==='ACTIVE'?'Đang học':'Đã rời lớp'}}</td>@if(auth.role()==='ADMIN'){<td>@if(e.status==='ACTIVE'){<input aria-label="Ngày rời lớp" type="date" [(ngModel)]="e.edit_enrolled_to" [name]="'enrolled_to_'+e.id" [min]="e.enrolled_from" /><button class="button-link" [disabled]="savingEnrollment()===e.id" (click)="leaveEnrollment(e)">{{savingEnrollment()===e.id?'Đang lưu…':'Cho nghỉ'}}</button>}@else{<span class="muted">Không mở lại</span>}</td>}</tr>}@empty{<tr><td [attr.colspan]="auth.role()==='ADMIN'?6:5" class="empty">Chưa xếp lớp.</td></tr>}</tbody></table></div></section>
    @if(auth.role()==='ADMIN'){<form class="card form-card" (ngSubmit)="createEnrollment()"><h2>Tạo enrollment mới</h2><p class="muted">Dùng thao tác này khi học sinh quay lại lớp; enrollment đã LEFT sẽ không được mở lại.</p><div class="form-grid"><label>Lớp *<select name="rejoin_class" [(ngModel)]="rejoinForm.class_id" required><option value="">Chọn lớp</option>@for(c of classes();track c.id){<option [value]="c.id">{{c.code}} · {{c.name}}</option>}</select></label><label>Ngày vào lớp *<input type="date" name="rejoin_date" [(ngModel)]="rejoinForm.enrolled_from" required /></label><label>Đơn giá riêng (VND)<input type="number" min="0" step="1" name="rejoin_fee" [(ngModel)]="rejoinForm.unit_price_override" /></label></div><button class="primary" type="submit">Tạo enrollment</button></form>}
    <div class="grid-2"><section class="card section-card"><h2>Chuyên cần kỳ hiện tại</h2><div class="table-wrap"><table><thead><tr><th>Lớp</th><th>Có mặt</th><th>Vắng</th><th>Có phép</th></tr></thead><tbody>@for(a of attendanceSummary();track a.class_id){<tr><td>{{a.class?.code||a.class_id}}</td><td>{{a.present_count}}</td><td>{{a.absent_count}}</td><td>{{a.excused_count}}</td></tr>}@empty{<tr><td colspan="4" class="empty">Chưa có dữ liệu.</td></tr>}</tbody></table></div></section><section class="card section-card"><h2>Đánh giá kỳ hiện tại</h2><div class="table-wrap"><table><thead><tr><th>Lớp</th><th>BTVN</th><th>Hiểu bài</th><th>Thái độ</th><th>Cập nhật</th></tr></thead><tbody>@for(a of evaluations();track a.class_id){<tr><td>{{a.class?.code||a.class_id}}</td><td>{{a.avg_homework||'—'}}</td><td>{{a.avg_understanding||'—'}}</td><td>{{a.avg_attitude||'—'}}</td><td>{{a.last_evaluated_at||'—'}}</td></tr>}@empty{<tr><td colspan="5" class="empty">Chưa có đánh giá.</td></tr>}</tbody></table></div></section></div>
  `,
})
export class StudentDetailComponent implements OnInit {
  id = '';
  student = signal<any>(null);
  enrollments = signal<any[]>([]);
  classes = signal<any[]>([]);
  ledgers = signal<any[]>([]);
  attendanceSummary = signal<any[]>([]);
  evaluations = signal<any[]>([]);
  error = signal('');
  savingEnrollment = signal('');
  editing = false;
  rejoinForm = { class_id: '', enrolled_from: new Date().toISOString().slice(0, 10), unit_price_override: null as number | null };
  form = { code: '', full_name: '', phone: '', parent_name: '', parent_phone: '', status: 'ACTIVE', note: '' };

  constructor(private readonly route: ActivatedRoute, private readonly supabase: SupabaseService, readonly auth: AuthService, readonly period: PeriodContextService, private readonly confirm: ConfirmService, private readonly toast: ToastService) {}

  ngOnInit() { this.id = this.route.snapshot.paramMap.get('id') || ''; void this.load(); }

  async load() {
    await this.period.ready;
    const studentResult = await this.supabase.client.from('students').select('*').eq('id', this.id).maybeSingle();
    if (studentResult.error) this.error.set(studentResult.error.message);
    else { this.student.set(studentResult.data); if (!this.editing && studentResult.data) this.form = { code: studentResult.data.code, full_name: studentResult.data.full_name, phone: studentResult.data.phone || '', parent_name: studentResult.data.parent_name || '', parent_phone: studentResult.data.parent_phone || '', status: studentResult.data.status, note: studentResult.data.note || '' }; }

    const enrollmentResult = await this.supabase.client.from('enrollments').select('id,enrolled_from,enrolled_to,unit_price_override,status,class:classes(code,name)').eq('student_id', this.id).order('enrolled_from', { ascending: false });
    if (enrollmentResult.error) { this.error.set(enrollmentResult.error.message); return; }
    this.enrollments.set((enrollmentResult.data || []).map((row: any) => ({ ...row, edit_enrolled_to: row.enrolled_to || new Date().toISOString().slice(0, 10) })));
    if (this.auth.role() === 'ADMIN') {
      const classResult = await this.supabase.client.from('classes').select('id,code,name').eq('status', 'ACTIVE').order('grade');
      if (classResult.error) this.error.set(classResult.error.message); else this.classes.set(classResult.data || []);
    }
    const p = this.period.current();
    if (p) {
      const [attendance, evaluation] = await Promise.all([
        this.supabase.client.from('v_student_attendance_summary').select('*,class:classes(code)').eq('student_id', this.id).eq('period_id', p.id),
        this.supabase.client.from('v_student_evaluation_summary').select('*,class:classes(code)').eq('student_id', this.id).eq('period_id', p.id),
      ]);
      if (attendance.error) this.error.set(attendance.error.message); else this.attendanceSummary.set(attendance.data || []);
      if (evaluation.error) this.error.set(evaluation.error.message); else this.evaluations.set(evaluation.data || []);
    }
    if (!this.financeVisible()) { this.ledgers.set([]); return; }
    const enrollmentIds = (enrollmentResult.data || []).map((item: any) => item.id).filter(Boolean);
    if (!enrollmentIds.length) { this.ledgers.set([]); return; }
    const ledgerResult = await this.supabase.client.from('tuition_ledgers').select('id,period_id,debt_amount,amount_due,paid_amount,enrollment_id').in('enrollment_id', enrollmentIds).order('period_id', { ascending: false });
    if (ledgerResult.error) this.error.set(ledgerResult.error.message); else this.ledgers.set(ledgerResult.data || []);
  }

  startEdit() { this.editing = !this.editing; if (this.student() && this.editing) { const item = this.student(); this.form = { code: item.code, full_name: item.full_name, phone: item.phone || '', parent_name: item.parent_name || '', parent_phone: item.parent_phone || '', status: item.status, note: item.note || '' }; } }

  async save() {
    if (!this.form.code.trim() || !this.form.full_name.trim()) { this.error.set('Mã và họ tên là bắt buộc.'); return; }
    if (this.form.status === 'INACTIVE' && !this.confirm.ask('Tạm dừng học sinh này? Các enrollment active sẽ được kết thúc, lịch sử vẫn được giữ.')) return;
    const result = await this.supabase.client.rpc('rpc_update_student', { p_student_id: this.id, p_code: this.form.code.trim(), p_full_name: this.form.full_name.trim(), p_phone: this.form.phone.trim() || null, p_parent_name: this.form.parent_name.trim() || null, p_parent_phone: this.form.parent_phone.trim() || null, p_status: this.form.status, p_note: this.form.note.trim() || null });
    if (result.error) this.error.set(result.error.message); else { this.toast.success('Đã cập nhật hồ sơ.'); this.editing = false; await this.load(); }
  }

  async leaveEnrollment(enrollment: any) {
    const enrolledTo = String(enrollment.edit_enrolled_to || '').trim();
    if (!enrolledTo || enrolledTo < enrollment.enrolled_from) { this.error.set('Ngày rời lớp phải từ ngày bắt đầu học trở đi.'); return; }
    if (!this.confirm.ask('Kết thúc enrollment này? Lịch sử học tập và học phí vẫn được giữ.')) return;
    this.savingEnrollment.set(enrollment.id);
    const result = await this.supabase.client.rpc('rpc_update_enrollment_status', { p_enrollment_id: enrollment.id, p_status: 'LEFT', p_enrolled_to: enrolledTo });
    this.savingEnrollment.set('');
    if (result.error) this.error.set(result.error.message); else { this.toast.success('Đã cập nhật trạng thái xếp lớp.'); await this.load(); }
  }

  async createEnrollment() {
    const fee = this.rejoinForm.unit_price_override;
    if (!this.rejoinForm.class_id || !this.rejoinForm.enrolled_from || fee !== null && (!Number.isSafeInteger(Number(fee)) || Number(fee) < 0)) { this.error.set('Vui lòng chọn lớp, ngày vào hợp lệ và đơn giá là số nguyên VND.'); return; }
    if (!this.confirm.ask('Tạo enrollment ACTIVE mới cho học sinh này?')) return;
    const result = await this.supabase.client.rpc('rpc_create_enrollment', { p_student_id: this.id, p_class_id: this.rejoinForm.class_id, p_enrolled_from: this.rejoinForm.enrolled_from, p_unit_price_override: fee });
    if (result.error) this.error.set(result.error.message.includes('CONFLICT') ? 'Học sinh đang có enrollment ACTIVE trong lớp này.' : result.error.message);
    else { this.toast.success('Đã tạo enrollment mới.'); this.rejoinForm = { class_id: '', enrolled_from: new Date().toISOString().slice(0, 10), unit_price_override: null }; await this.load(); }
  }

  financeVisible() { return ['ADMIN', 'ACCOUNTANT'].includes(this.auth.role() || ''); }
  money(v: unknown) { return formatMoney(Number(v || 0)); }
}
