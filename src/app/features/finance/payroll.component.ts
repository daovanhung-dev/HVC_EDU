import { Component, OnInit, signal } from '@angular/core';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { AuthService } from '../../core/auth/auth.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { formatMoney } from '../../core/utils/money.util';
import { formatPercent } from '../../core/utils/display.util';
import { ConfirmService } from '../../core/services/confirm.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">TÀI CHÍNH · NHÂN SỰ</p><h1>Payroll</h1><p class="muted">Policy, cap và rounding được tính server-side.</p></div><div><button class="secondary" [disabled]="calculating" (click)="calculate(true)">Preview</button><button class="primary" [disabled]="calculating || runStatus()==='APPROVED'" (click)="calculate(false)">{{calculating?'Đang tính…':runStatus()==='APPROVED'?'Đã duyệt':'Lưu bản nháp'}}</button></div></section>
    @if(error()){<div class="alert">{{error()}}</div>}
    <section class="card section-card"><div class="workflow-stepper"><div class="workflow-step done"><span>1</span><strong>Preview</strong><small>Kiểm tra cách tính</small></div><div class="workflow-line"></div><div class="workflow-step" [class.done]="runId()"><span>2</span><strong>Lưu bản nháp</strong><small>Snapshot kỳ hiện tại</small></div><div class="workflow-line"></div><div class="workflow-step" [class.done]="runStatus()==='APPROVED'"><span>3</span><strong>Duyệt</strong><small>Khóa payroll</small></div></div><div class="stat-list payroll-summary"><div><span>Tổng lương</span><strong>{{money(total())}}</strong></div><div><span>Trạng thái</span><app-status-badge [value]="runStatus()" /></div><div><span>Policy</span><strong>{{policy()?.teacher_percent*100||25}}% GV · {{policy()?.assistant_percent*100||15}}% TG · cap {{policy()?.max_total_percent*100||40}}%</strong></div></div></section>
    <div class="card table-wrap"><table><thead><tr><th>Nhân sự</th><th>Mã NS</th><th>Lớp</th><th>Mã lớp</th><th>Vai trò</th><th>Doanh thu</th><th>Tỷ lệ</th><th>Lương cơ bản</th><th>Thưởng</th><th>Phạt</th><th>Thực nhận</th></tr></thead><tbody>@for(i of items();track i.staff_id+i.class_id+i.role){<tr><td>{{i.staff?.full_name||i.staff_id}}</td><td>{{i.staff?.code||'—'}}</td><td>{{i.class?.name||i.class_id}}</td><td>{{i.class?.code||'—'}}</td><td>{{roleLabel(i.role)}}</td><td>{{money(i.class_revenue)}}</td><td>{{formatPercent(i.applied_percent, 2)}}</td><td>{{money(i.base_amount)}}</td><td>{{money(i.bonus)}}</td><td>{{money(i.penalty)}}</td><td><strong>{{money(i.final_amount)}}</strong></td></tr>}@empty{<tr><td colspan="11" class="empty">Chưa có dữ liệu payroll.</td></tr>}</tbody></table></div>
    @if(runId()){<section class="card section-card payroll-actions"><div><strong>Payroll kỳ hiện tại</strong><p class="muted">Bản nháp đã lưu. Hãy kiểm tra breakdown trước khi duyệt.</p></div>@if(auth.role()==='ADMIN'&&runStatus()!=='APPROVED'){<button class="primary" (click)="approve()">Duyệt payroll</button>}</section>}
  `,
})
export class PayrollComponent implements OnInit {
  items = signal<any[]>([]);
  policy = signal<any>(null);
  total = signal(0);
  runId = signal('');
  runStatus = signal('');
  error = signal('');
  calculating = false;

  constructor(private readonly edge: EdgeFunctionService, readonly period: PeriodContextService, private readonly supabase: SupabaseService, private readonly toast: ToastService, readonly auth: AuthService, private readonly confirm: ConfirmService) {}

  ngOnInit() { void this.loadRun(); }

  async loadRun() {
    await this.period.ready;
    const current = this.period.current();
    if (!current) return;
    const policy = await this.supabase.client.from('payroll_policies').select('id,name,teacher_percent,assistant_percent,max_total_percent,rounding_step').lte('effective_from', current.start_date).or(`effective_to.is.null,effective_to.gte.${current.start_date}`).eq('active', true).order('effective_from', { ascending: false }).limit(1).maybeSingle();
    if (!policy.error) this.policy.set(policy.data);
    const run = await this.supabase.client.from('payroll_runs').select('id,status,total_amount').eq('period_id', current.id).maybeSingle();
    if (run.error) { this.error.set(run.error.message); return; }
    if (!run.data) { this.runId.set(''); this.runStatus.set(''); this.items.set([]); this.total.set(0); return; }
    this.runId.set(run.data.id);
    this.runStatus.set(run.data.status);
    this.total.set(Number(run.data.total_amount || 0));
    const rows = await this.supabase.client.from('payroll_items').select('id,staff_id,class_id,role,class_revenue,applied_percent,base_amount,bonus,penalty,final_amount').eq('payroll_run_id', run.data.id);
    if (rows.error) this.error.set(rows.error.message); else this.items.set(await this.decorate(rows.data || []));
  }

  async calculate(dryRun: boolean) {
    const current = this.period.current();
    if (!current) { this.error.set('Chưa chọn kỳ kế toán.'); return; }
    this.error.set('');
    this.calculating = true;
    try {
      const result = await this.edge.invoke<any>('calculate-payroll', { period_id: current.id, dry_run: dryRun });
      this.items.set(await this.decorate(result.items || []));
      this.total.set(Number(result.total_amount || 0));
      this.policy.set(result.policy);
      if (!dryRun) { this.runId.set(result.payroll_run_id); this.runStatus.set('DRAFT'); this.toast.success('Đã lưu payroll bản nháp.'); }
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể tính payroll.'); }
    finally { this.calculating = false; }
  }

  async approve() {
    if (!this.runId()) return;
    if (!this.confirm.ask('Duyệt payroll kỳ hiện tại? Sau khi duyệt, breakdown sẽ được khóa để bảo toàn snapshot.')) return;
    try { await this.edge.invoke('approve-payroll', { payroll_run_id: this.runId() }); this.toast.success('Đã duyệt payroll.'); await this.loadRun(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể duyệt payroll.'); }
  }

  private async decorate(items: any[]) {
    const staffIds = [...new Set(items.map((item) => item.staff_id).filter(Boolean))];
    const classIds = [...new Set(items.map((item) => item.class_id).filter(Boolean))];
    if (!staffIds.length && !classIds.length) return items;
    const [staffResult, classResult] = await Promise.all([
      staffIds.length ? this.supabase.client.from('staff').select('id,code,full_name').in('id', staffIds) : Promise.resolve({ data: [], error: null } as any),
      classIds.length ? this.supabase.client.from('classes').select('id,code,name').in('id', classIds) : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (staffResult.error) this.error.set(staffResult.error.message);
    if (classResult.error) this.error.set(classResult.error.message);
    const staffMap = new Map((staffResult.data || []).map((row: any) => [row.id, row]));
    const classMap = new Map((classResult.data || []).map((row: any) => [row.id, row]));
    return items.map((item) => ({ ...item, staff: item.staff || staffMap.get(item.staff_id), class: item.class || classMap.get(item.class_id) }));
  }

  roleLabel(role: string) { return role === 'MAIN_TEACHER' ? 'Giáo viên chính' : 'Trợ giảng'; }
  formatPercent(value: unknown, fractionDigits = 1) { return formatPercent(Number(value || 0), fractionDigits); }
  money(v: unknown) { return formatMoney(Number(v || 0)); }
}
