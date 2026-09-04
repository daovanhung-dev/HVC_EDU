import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { formatMoney } from '../../core/utils/money.util';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({
  selector: 'app-tuition-class',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">HỌC PHÍ</p><h1>{{class()?.code||'Lớp'}} · {{class()?.name}}</h1><p class="muted">Ledger từng học sinh trong kỳ.</p></div><div><button class="primary" [disabled]="generating" (click)="generate()">{{generating?'Đang sinh…':'Sinh / cập nhật học phí'}}</button><a class="secondary" routerLink="/finance/tuition">Tổng quan</a></div></section>
    @if(error()){<div class="alert">{{error()}}</div>}
    <div class="card table-wrap"><table><thead><tr><th>Học sinh</th><th>Đơn giá</th><th>Buổi tính phí</th><th>Phải thu</th><th>Đã thu</th><th>Nợ</th><th>Trạng thái</th><th></th></tr></thead><tbody>@for(l of ledgers();track l.id){<tr><td>{{l.enrollment?.student?.code}} · {{l.enrollment?.student?.full_name}}</td><td>{{money(l.unit_price)}}</td><td>{{l.billable_sessions}}</td><td>{{money(l.amount_due)}}</td><td>{{money(l.paid_amount)}}</td><td class="danger">{{money(l.debt_amount)}}</td><td><app-status-badge [value]="l.status" /></td><td><a class="button-link" [routerLink]="['/finance/payments/new']" [queryParams]="{ledgerId:l.id}">Thu</a></td></tr>}@empty{<tr><td colspan="8" class="empty">Chưa có ledger trong kỳ.</td></tr>}</tbody></table></div>
    <section class="card section-card"><h2>Lịch sử thanh toán</h2><div class="table-wrap"><table><thead><tr><th>Ngày thu</th><th>Số tiền</th><th>Phương thức</th><th>Tham chiếu</th><th>Trạng thái</th><th></th></tr></thead><tbody>@for(p of payments();track p.id){<tr><td>{{p.paid_at}}</td><td>{{money(p.amount)}}</td><td>{{p.method}}</td><td>{{p.reference||'—'}}</td><td>{{p.voided_at?'Đã void':'Hiệu lực'}}</td><td>@if(!p.voided_at){<button class="secondary" (click)="voidPayment(p)">Void</button>}</td></tr>}@empty{<tr><td colspan="6" class="empty">Chưa có thanh toán.</td></tr>}</tbody></table></div></section>
  `,
})
export class TuitionClassComponent implements OnInit {
  id = '';
  class = signal<any>(null);
  ledgers = signal<any[]>([]);
  payments = signal<any[]>([]);
  error = signal('');
  generating = false;

  constructor(private readonly route: ActivatedRoute, private readonly supabase: SupabaseService, readonly period: PeriodContextService, private readonly edge: EdgeFunctionService, private readonly toast: ToastService, private readonly confirm: ConfirmService) {}

  ngOnInit() { this.id = this.route.snapshot.paramMap.get('classId') || ''; void this.load(); }

  async load() {
    await this.period.ready;
    const c = await this.supabase.client.from('classes').select('id,code,name').eq('id', this.id).maybeSingle();
    if (!c.error) this.class.set(c.data);
    const p = this.period.current();
    if (!p) return;
    const l = await this.supabase.client.from('tuition_ledgers').select('*,enrollment:enrollments!inner(class_id,student:students(code,full_name))').eq('period_id', p.id).eq('enrollment.class_id', this.id);
    if (l.error) { this.error.set(l.error.message); return; }
    const ledgers = l.data || [];
    this.ledgers.set(ledgers);
    const ledgerIds = ledgers.map((item: any) => item.id).filter(Boolean);
    if (!ledgerIds.length) { this.payments.set([]); return; }
    const paymentResult = await this.supabase.client.from('payments').select('id,tuition_ledger_id,amount,paid_at,method,reference,voided_at').in('tuition_ledger_id', ledgerIds).order('paid_at', { ascending: false });
    if (paymentResult.error) this.error.set(paymentResult.error.message); else this.payments.set(paymentResult.data || []);
  }

  async generate() {
    const p = this.period.current();
    if (!p) return;
    this.generating = true;
    try { await this.edge.invoke('generate-tuition', { period_id: p.id, class_id: this.id }); this.toast.success('Đã sinh ledger học phí.'); await this.load(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể sinh học phí.'); }
    finally { this.generating = false; }
  }

  async voidPayment(payment: any) {
    if (!this.confirm.ask('Void thanh toán này? Lịch sử vẫn được giữ và công nợ sẽ được tính lại.')) return;
    const reason = window.prompt('Lý do void thanh toán:')?.trim();
    if (!reason) return;
    try { await this.edge.invoke('void-payment', { payment_id: payment.id, reason }); this.toast.success('Đã void thanh toán.'); await this.load(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể void thanh toán.'); }
  }

  money(v: unknown) { return formatMoney(Number(v || 0)); }
}
