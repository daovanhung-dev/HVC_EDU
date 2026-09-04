import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';

@Component({ selector: 'app-settings', standalone: true, imports: [CommonModule, FormsModule], template: `
<section class="page-header"><div><p class="eyebrow">HỆ THỐNG</p><h1>Thiết lập</h1><p class="muted">Chính sách, quỹ và phân quyền được lưu tại DB.</p></div></section>
@if(error()){<div class="alert">{{error()}}</div>}
<div class="grid-2"><section class="card form-card"><h2>Quỹ</h2><form (ngSubmit)="saveFund()"><label>Tỷ lệ trích quỹ (%)<input name="fund" type="number" min="0" max="100" step="0.01" [(ngModel)]="fundPercent" /></label><div class="form-actions"><button class="primary">Lưu thiết lập</button></div></form></section><section class="card section-card"><h2>Payroll policies</h2>@for(p of policies();track p.id){<div class="stat-list"><div><span>{{p.name}}</span><strong>{{p.teacher_percent*100}}% GV · {{p.assistant_percent*100}}% TG · cap {{p.max_total_percent*100}}% · bước {{p.rounding_step}}</strong></div></div>}@empty{<p class="muted">Chưa có policy.</p>}</section></div>
<section class="card section-card"><h2>Người dùng & phân quyền</h2><div class="table-wrap"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Hoạt động</th><th></th></tr></thead><tbody>@for(profile of profiles();track profile.user_id){<tr><td>{{profile.full_name}}</td><td><select [name]="'role-' + profile.user_id" [(ngModel)]="profile.role"><option value="ADMIN">Quản trị viên</option><option value="ACCOUNTANT">Kế toán</option><option value="TEACHER">Giáo viên</option><option value="ASSISTANT">Trợ giảng</option></select></td><td><input type="checkbox" [name]="'active-' + profile.user_id" [(ngModel)]="profile.active" /></td><td><button class="secondary" type="button" (click)="saveProfile(profile)">Lưu quyền</button></td></tr>}@empty{<tr><td colspan="4" class="empty">Chưa có profile.</td></tr>}</tbody></table></div></section>
<section class="card section-card"><h2>System settings</h2>@for(s of settings();track s.id){<div class="stat-list"><div><span>{{s.key}}</span><code>{{s.value_json|json}}</code></div></div>}@empty{<p class="muted">Chưa có thiết lập.</p>}</section>
` })
export class SettingsComponent implements OnInit {
  policies = signal<any[]>([]);
  settings = signal<any[]>([]);
  profiles = signal<any[]>([]);
  error = signal('');
  fundPercent = 10;

  constructor(private readonly supabase: SupabaseService, private readonly edge: EdgeFunctionService, private readonly confirm: ConfirmService, private readonly toast: ToastService) {}

  ngOnInit() { void this.load(); }

  async load() {
    const [policyResult, settingResult, profileResult] = await Promise.all([
      this.supabase.client.from('payroll_policies').select('*').order('effective_from', { ascending: false }),
      this.supabase.client.from('system_settings').select('*').order('key'),
      this.supabase.client.from('profiles').select('user_id,full_name,role,staff_id,active').order('full_name'),
    ]);
    if (policyResult.error || settingResult.error || profileResult.error) {
      this.error.set((policyResult.error || settingResult.error || profileResult.error)?.message || 'Không thể tải setting.');
      return;
    }
    this.policies.set(policyResult.data || []);
    this.settings.set(settingResult.data || []);
    this.profiles.set(profileResult.data || []);
    const fund = (settingResult.data || []).find((item: any) => item.key === 'fund');
    if (fund?.value_json?.fund_percent !== undefined) this.fundPercent = Number(fund.value_json.fund_percent) * 100;
  }

  async saveFund() {
    if (!Number.isFinite(Number(this.fundPercent)) || Number(this.fundPercent) < 0 || Number(this.fundPercent) > 100) {
      this.error.set('Tỷ lệ quỹ phải nằm trong khoảng 0–100%.');
      return;
    }
    try {
      await this.edge.invoke('update-setting', { key: 'fund', value_json: { fund_percent: Number(this.fundPercent) / 100 } });
      this.toast.success('Đã lưu tỷ lệ quỹ.');
      await this.load();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu setting.'); }
  }

  async saveProfile(profile: any) {
    if (!this.confirm.ask(`Cập nhật quyền của ${profile.full_name}?`)) return;
    try {
      await this.edge.invoke('update-profile-role', { user_id: profile.user_id, role: profile.role, active: !!profile.active });
      this.toast.success('Đã cập nhật phân quyền.');
      await this.load();
    } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể cập nhật quyền.'); }
  }
}
