import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { ToastService } from '../../core/services/toast.service';
import { formatMoney } from '../../core/utils/money.util';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [FormsModule, StatusBadgeComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">TÀI CHÍNH</p><h1>Công nợ & điều chỉnh</h1><p class="muted">Điều chỉnh có lý do và carry-over được audit, không xoá lịch sử.</p></div><button class="secondary" (click)="load()">Làm mới</button></section>
    @if(error()){<div class="alert">{{error()}}</div>}
    <div class="grid-2">
      <form class="card form-card" (ngSubmit)="saveAdjustment()"><h2>Điều chỉnh ledger</h2><label>Học sinh / ledger<select name="ledger" [(ngModel)]="form.ledger_id"><option value="">Chọn ledger</option>@for(l of items();track l.id){<option [value]="l.id">{{l.enrollment?.student?.full_name}} · nợ {{money(l.debt_amount)}}</option>}</select></label><div class="form-grid"><label>Loại<select name="type" [(ngModel)]="form.type"><option value="DISCOUNT">Giảm trừ</option><option value="MANUAL">Điều chỉnh tăng</option><option value="OPENING_DEBT">Nợ đầu kỳ</option></select></label><label>Số tiền VND<input name="amount" type="number" min="0" step="1" [(ngModel)]="form.amount" /></label></div><label>Lý do *<input name="reason" [(ngModel)]="form.reason" required /></label><button class="primary">Lưu điều chỉnh</button></form>
      <form class="card form-card" (ngSubmit)="carryOver()"><h2>Carry-over sang kỳ sau</h2><label>Kỳ đích<select name="to_period_id" [(ngModel)]="carryForm.to_period_id"><option value="">Chọn kỳ OPEN</option>@for(p of openTargets();track p.id){<option [value]="p.id">{{p.month}}/{{p.year}}</option>}</select></label><p class="muted">Chỉ chuyển phần nợ còn lại của kỳ {{period.current()?.month}}/{{period.current()?.year}}.</p><button class="primary" [disabled]="!carryForm.to_period_id">Carry-over</button></form>
    </div>
    <div class="toolbar"><label>Tìm kiếm<input [(ngModel)]="search" placeholder="Học sinh" /></label><label>Chỉ còn nợ<select [(ngModel)]="onlyDebt"><option value="true">Có</option><option value="false">Tất cả</option></select></label></div>
    <div class="card table-wrap"><table><thead><tr><th>Học sinh</th><th>Lớp</th><th>Nợ đầu kỳ</th><th>Phải thu</th><th>Đã thu</th><th>Nợ hiện tại</th><th>Trạng thái</th></tr></thead><tbody>@for(l of filtered();track l.id){<tr><td>{{l.enrollment?.student?.full_name}}</td><td>{{l.enrollment?.class?.code}}</td><td>{{money(l.opening_debt)}}</td><td>{{money(l.amount_due)}}</td><td>{{money(l.paid_amount)}}</td><td class="danger">{{money(l.debt_amount)}}</td><td><app-status-badge [value]="l.status" /></td></tr>}@empty{<tr><td colspan="7" class="empty">Không có công nợ.</td></tr>}</tbody></table></div>
  `,
})
export class DebtsComponent implements OnInit {
  items = signal<any[]>([]);
  search = '';
  onlyDebt = 'true';
  error = signal('');
  form = { ledger_id: '', type: 'DISCOUNT', amount: 0, reason: '' };
  carryForm = { to_period_id: '' };

  constructor(private readonly supabase: SupabaseService, readonly period: PeriodContextService, private readonly edge: EdgeFunctionService, private readonly toast: ToastService) {}

  ngOnInit() { void this.load(); }

  async load() {
    await this.period.ready;
    const p = this.period.current();
    if (!p) return;
    const r = await this.supabase.client.from('tuition_ledgers').select('*,enrollment:enrollments(student:students(full_name),class:classes(code))').eq('period_id', p.id).order('debt_amount', { ascending: false });
    if (r.error) this.error.set(r.error.message); else this.items.set(r.data || []);
  }

  async saveAdjustment() {
    const p = this.period.current();
    if (!p || !this.form.ledger_id || !this.form.reason.trim() || !Number.isSafeInteger(Number(this.form.amount)) || Number(this.form.amount) < 0) { this.error.set('Chọn ledger, nhập số tiền nguyên và lý do.'); return; }
    const ledger = this.items().find((item) => item.id === this.form.ledger_id);
    if (!ledger?.enrollment_id) { this.error.set('Ledger không hợp lệ.'); return; }
    try {
      await this.edge.invoke('create-tuition-adjustment', { enrollment_id: ledger.enrollment_id, period_id: p.id, type: this.form.type, amount: Number(this.form.amount), reason: this.form.reason.trim() });
      this.toast.success('Đã lưu điều chỉnh công nợ.');
      this.form = { ledger_id: '', type: 'DISCOUNT', amount: 0, reason: '' };
      await this.load();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể lưu điều chỉnh.'); }
  }

  async carryOver() {
    const from = this.period.current();
    if (!from || !this.carryForm.to_period_id) return;
    try {
      await this.edge.invoke('carry-over-period', { from_period_id: from.id, to_period_id: this.carryForm.to_period_id }, `carry-${from.id}-${this.carryForm.to_period_id}`);
      this.toast.success('Đã carry-over công nợ.');
      await this.load();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể carry-over.'); }
  }

  openTargets() {
    const current = this.period.current();
    return this.period.periods().filter((item) => item.status === 'OPEN' && item.id !== current?.id && (current ? item.start_date > current.end_date : true));
  }

  filtered() { const q = this.search.trim().toLowerCase(); return this.items().filter((l) => (this.onlyDebt !== 'true' || Number(l.debt_amount) > 0) && (!q || String(l.enrollment?.student?.full_name || '').toLowerCase().includes(q))); }
  money(v: unknown) { return formatMoney(Number(v || 0)); }
}
