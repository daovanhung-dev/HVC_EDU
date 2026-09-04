import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { formatMoney } from '../../core/utils/money.util';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-staff-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">NHÂN SỰ</p><h1>{{staff()?.full_name||'Chi tiết nhân sự'}}</h1><p class="muted">{{staff()?.code}} · {{staff()?.staff_type}}</p></div><div><a class="secondary" routerLink="/staff">Danh sách</a>@if(auth.role()==='ADMIN'){<button class="primary" (click)="startEdit()">{{editing?'Đóng sửa':'Sửa hồ sơ'}}</button>}</div></section>
    @if(error()){<div class="alert">{{error()}}</div>}
    @if(editing&&auth.role()==='ADMIN'){<form class="card form-card" (ngSubmit)="save()"><h2>Chỉnh sửa nhân sự</h2><div class="form-grid"><label>Mã *<input name="code" [(ngModel)]="form.code" required /></label><label>Họ tên *<input name="full_name" [(ngModel)]="form.full_name" required /></label><label>Loại<select name="staff_type" [(ngModel)]="form.staff_type"><option value="TEACHER">Giáo viên</option><option value="ASSISTANT">Trợ giảng</option></select></label><label>SĐT<input name="phone" [(ngModel)]="form.phone" /></label><label>Môn<input name="subject" [(ngModel)]="form.primary_subject" /></label><label>Trạng thái<select name="status" [(ngModel)]="form.status"><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label><label class="full">Ghi chú<textarea name="note" rows="2" [(ngModel)]="form.note"></textarea></label></div><div class="form-actions"><button class="primary">Lưu thay đổi</button><button type="button" class="secondary" (click)="startEdit()">Hủy</button></div></form>}
    <section class="card section-card"><h2>Tài khoản</h2><div class="stat-list"><div><span>Email</span><strong>{{staff()?.email||'—'}}</strong></div><div><span>Trạng thái</span><strong>{{accountLabel()}}</strong></div></div>@if(auth.role()==='ADMIN'&&!profile()&&staff()?.status==='ACTIVE'){<form class="form-card" (ngSubmit)="sendInvite()"><label>Email nhận lời mời *<input type="email" name="invite_email" [(ngModel)]="inviteEmail" required autocomplete="off" /></label><p class="muted">Xác nhận email rồi gửi lời mời. Mật khẩu sẽ được đặt ở luồng reset-password.</p><button class="primary" type="submit">Tạo tài khoản</button></form>}</section>
    <section class="card section-card"><h2>Thông tin</h2><div class="stat-list"><div><span>Loại</span><strong>{{staff()?.staff_type==='TEACHER'?'Giáo viên':'Trợ giảng'}}</strong></div><div><span>Môn</span><strong>{{staff()?.primary_subject||'—'}}</strong></div><div><span>Điện thoại</span><strong>{{staff()?.phone||'—'}}</strong></div><div><span>Trạng thái nhân sự</span><app-status-badge [value]="staff()?.status" /></div></div></section>
    <section class="card section-card"><h2>Phân công</h2><div class="table-wrap"><table><thead><tr><th>Lớp</th><th>Vai trò</th><th>Từ ngày</th><th>Đến ngày</th><th>Số buổi dự kiến</th></tr></thead><tbody>@for(a of assignments();track a.id){<tr><td>{{a.class?.code}} · {{a.class?.name}}</td><td>{{roleLabel(a.role)}}</td><td>{{a.start_date}}</td><td>{{a.end_date||'—'}}</td><td>{{a.planned_sessions||'—'}}</td></tr>}@empty{<tr><td colspan="5" class="empty">Chưa có phân công.</td></tr>}</tbody></table></div></section>
    <section class="card section-card"><h2>Lịch sử payroll</h2>@for(p of payroll();track p.id){<div class="stat-list"><div><span>{{p.payroll_run?.period?.month}}/{{p.payroll_run?.period?.year}}</span><strong><app-status-badge [value]="p.payroll_run?.status" /> {{money(p.final_amount)}}</strong></div></div>}@empty{<p class="muted">Chưa có payroll.</p>}</section>
  `,
})
export class StaffDetailComponent implements OnInit {
  id = '';
  staff = signal<any>(null);
  profile = signal<any>(null);
  assignments = signal<any[]>([]);
  payroll = signal<any[]>([]);
  error = signal('');
  inviteEmail = '';
  editing = false;
  form = { code: '', full_name: '', staff_type: 'TEACHER', phone: '', primary_subject: '', status: 'ACTIVE', note: '' };

  constructor(private readonly route: ActivatedRoute, private readonly supabase: SupabaseService, readonly auth: AuthService, private readonly confirm: ConfirmService, private readonly toast: ToastService, private readonly edge: EdgeFunctionService) {}

  ngOnInit() { this.id = this.route.snapshot.paramMap.get('id') || ''; void this.load(); }

  async load() {
    const s = await this.supabase.client.from('staff').select('*').eq('id', this.id).maybeSingle();
    if (s.error) this.error.set(s.error.message);
    else {
      this.staff.set(s.data);
      if (!this.editing && s.data) this.form = { code: s.data.code, full_name: s.data.full_name, staff_type: s.data.staff_type, phone: s.data.phone || '', primary_subject: s.data.primary_subject || '', status: s.data.status, note: s.data.note || '' };
      if (s.data?.email) this.inviteEmail = s.data.email;
    }
    this.profile.set(null);
    if (['ADMIN', 'ACCOUNTANT'].includes(this.auth.role() || '')) {
      const profileResult = await this.supabase.client.from('profiles').select('user_id,staff_id,active').eq('staff_id', this.id).maybeSingle();
      if (profileResult.error) this.error.set(profileResult.error.message); else this.profile.set(profileResult.data);
    }
    const a = await this.supabase.client.from('class_assignments').select('id,role,start_date,end_date,planned_sessions,class:classes(code,name)').eq('staff_id', this.id);
    if (!a.error) this.assignments.set(a.data || []);
    const p = await this.supabase.client.from('payroll_items').select('id,final_amount,payroll_run:payroll_runs(status,period:accounting_periods(year,month))').eq('staff_id', this.id);
    if (!p.error) this.payroll.set(p.data || []);
  }

  startEdit() { this.editing = !this.editing; if (this.staff() && this.editing) { const item = this.staff(); this.form = { code: item.code, full_name: item.full_name, staff_type: item.staff_type, phone: item.phone || '', primary_subject: item.primary_subject || '', status: item.status, note: item.note || '' }; } }

  async save() {
    if (!this.form.code.trim() || !this.form.full_name.trim()) { this.error.set('Mã và họ tên là bắt buộc.'); return; }
    if (this.form.status === 'INACTIVE' && !this.confirm.ask('Ngừng hoạt động nhân sự này? Tài khoản liên kết sẽ bị khóa, lịch sử vẫn được giữ.')) return;
    const result = await this.supabase.client.rpc('rpc_update_staff', { p_staff_id: this.id, p_code: this.form.code.trim(), p_full_name: this.form.full_name.trim(), p_staff_type: this.form.staff_type, p_phone: this.form.phone.trim() || null, p_primary_subject: this.form.primary_subject.trim() || null, p_status: this.form.status, p_note: this.form.note.trim() || null });
    if (result.error) this.error.set(result.error.message); else { this.toast.success('Đã cập nhật nhân sự.'); this.editing = false; await this.load(); }
  }

  async sendInvite() {
    const email = this.inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(email)) { this.error.set('Email không hợp lệ.'); return; }
    if (!this.staff() || !this.confirm.ask(`Gửi email mời tạo tài khoản tới ${email}?`)) return;
    try { await this.edge.invoke('invite-staff-account', { staff_id: this.id, email }); this.toast.success('Đã gửi lời mời tạo tài khoản.'); await this.load(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể gửi lời mời tài khoản.'); }
  }

  accountLabel() { return this.profile() ? (this.profile().active ? 'Đã liên kết và đang hoạt động' : 'Đã liên kết nhưng đang khóa') : 'Chưa có tài khoản'; }
  roleLabel(role: string) { return role === 'MAIN_TEACHER' ? 'Giáo viên chính' : 'Trợ giảng'; }
  money(v: unknown) { return formatMoney(Number(v || 0)); }
}
