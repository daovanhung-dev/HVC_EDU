import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { AuthService } from '../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">NHÂN SỰ</p><h1>Giảng viên & trợ giảng</h1></div>@if(auth.role()==='ADMIN'){<button class="primary" (click)="showForm=!showForm">{{showForm?'Đóng':'+ Thêm nhân sự'}}</button>}</section>
    @if(showForm&&auth.role()==='ADMIN'){<form class="card form-card" (ngSubmit)="save()"><div class="form-grid"><label>Mã *<input name="code" [(ngModel)]="form.code" required /></label><label>Họ tên *<input name="full_name" [(ngModel)]="form.full_name" required /></label><label>Loại<select name="staff_type" [(ngModel)]="form.staff_type"><option value="TEACHER">Giáo viên</option><option value="ASSISTANT">Trợ giảng</option></select></label><label>SĐT<input name="phone" [(ngModel)]="form.phone" /></label><label>Môn<input name="subject" [(ngModel)]="form.primary_subject" /></label></div>@if(error()){<div class="alert">{{error()}}</div>}<button class="primary">Lưu</button></form>}
    @if(inviteTarget()){<form class="card form-card" (ngSubmit)="sendInvite()"><h2>Tạo tài khoản nhân sự</h2><p>Xác nhận email nhận lời mời cho <strong>{{inviteTarget().full_name}}</strong> ({{inviteTarget().code}}).</p><label>Email *<input type="email" name="invite_email" [(ngModel)]="inviteEmail" required autocomplete="off" /></label><p class="muted">Supabase sẽ gửi email mời; Admin không tự đặt mật khẩu.</p>@if(error()){<div class="alert">{{error()}}</div>}<div class="form-actions"><button class="primary" type="submit">Gửi lời mời</button><button class="secondary" type="button" (click)="cancelInvite()">Hủy</button></div></form>}
    @if(error()&&!showForm&&!inviteTarget()){<div class="alert">{{error()}}</div>}
    <div class="card table-wrap"><table><thead><tr><th>Mã</th><th>Họ tên</th><th>Loại</th><th>Môn</th><th>SĐT</th><th>Email</th><th>Tài khoản</th><th>Trạng thái</th>@if(auth.role()==='ADMIN'){<th>Thao tác</th>}</tr></thead><tbody>@for(item of items();track item.id){<tr><td><a class="button-link" [routerLink]="['/staff',item.id]">{{item.code}}</a></td><td>{{item.full_name}}</td><td>{{item.staff_type==='TEACHER'?'Giáo viên':'Trợ giảng'}}</td><td>{{item.primary_subject||'—'}}</td><td>{{item.phone||'—'}}</td><td>{{item.email||'—'}}</td><td>{{accountLabel(item)}}</td><td><app-status-badge [value]="item.status" /></td>@if(auth.role()==='ADMIN'){<td>@if(item.account_status==='NONE'&&item.status==='ACTIVE'){<button class="button-link" (click)="startInvite(item)">Tạo tài khoản</button>}@else if(item.account_status==='LOCKED'){<span class="muted">Đã khóa</span>}@else if(item.account_status==='ACTIVE'){<span class="muted">Đã có</span>}</td>}</tr>}@empty{<tr><td [attr.colspan]="auth.role()==='ADMIN'?9:8" class="empty">Chưa có nhân sự.</td></tr>}</tbody></table></div>
  `,
})
export class StaffComponent implements OnInit {
  items = signal<any[]>([]);
  error = signal('');
  showForm = false;
  inviteTarget = signal<any>(null);
  inviteEmail = '';
  form = { code: '', full_name: '', staff_type: 'TEACHER', phone: '', primary_subject: 'Toán' };

  constructor(private readonly supabase: SupabaseService, private readonly toast: ToastService, private readonly edge: EdgeFunctionService, private readonly confirm: ConfirmService, readonly auth: AuthService) {}

  ngOnInit() { void this.load(); }

  async load() {
    const r = await this.supabase.client.from('staff').select('*').order('full_name');
    if (r.error) { this.error.set(r.error.message); return; }
    const rows = r.data || [];
    let profiles: any[] = [];
    if (['ADMIN', 'ACCOUNTANT'].includes(this.auth.role() || '')) {
      const p = await this.supabase.client.from('profiles').select('user_id,staff_id,active').not('staff_id', 'is', null);
      if (p.error) this.error.set(p.error.message); else profiles = p.data || [];
    }
    const profileMap = new Map(profiles.map((profile) => [profile.staff_id, profile]));
    this.items.set(rows.map((item: any) => {
      const profile = profileMap.get(item.id);
      return { ...item, account_status: profile ? (profile.active ? 'ACTIVE' : 'LOCKED') : 'NONE' };
    }));
  }

  startInvite(item: any) { this.error.set(''); this.inviteTarget.set(item); this.inviteEmail = item.email || ''; }
  cancelInvite() { this.inviteTarget.set(null); this.inviteEmail = ''; this.error.set(''); }

  async sendInvite() {
    const target = this.inviteTarget();
    const email = this.inviteEmail.trim().toLowerCase();
    if (!target || !/^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(email)) { this.error.set('Email không hợp lệ.'); return; }
    if (!this.confirm.ask(`Gửi email mời tạo tài khoản tới ${email}?`)) return;
    try {
      await this.edge.invoke('invite-staff-account', { staff_id: target.id, email });
      this.toast.success('Đã gửi lời mời tạo tài khoản.');
      this.cancelInvite();
      await this.load();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể gửi lời mời tài khoản.'); }
  }

  async save() {
    if (!this.form.code.trim() || !this.form.full_name.trim()) { this.error.set('Mã và họ tên là bắt buộc.'); return; }
    const r = await this.supabase.client.rpc('rpc_create_staff', { p_code: this.form.code.trim(), p_full_name: this.form.full_name.trim(), p_staff_type: this.form.staff_type, p_phone: this.form.phone.trim() || null, p_primary_subject: this.form.primary_subject.trim() || null });
    if (r.error) this.error.set(r.error.message); else { this.toast.success('Đã thêm nhân sự.'); this.showForm = false; this.form = { code: '', full_name: '', staff_type: 'TEACHER', phone: '', primary_subject: 'Toán' }; await this.load(); }
  }

  accountLabel(item: any) { return item.account_status === 'ACTIVE' ? 'Đã liên kết' : item.account_status === 'LOCKED' ? 'Đã khóa' : 'Chưa có tài khoản'; }
}
