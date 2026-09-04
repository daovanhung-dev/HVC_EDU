import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { ToastService } from '../../core/services/toast.service';
import { formatMoney } from '../../core/utils/money.util';
@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="page-header"><div><p class="eyebrow">TÀI CHÍNH · PAYMENT</p><h1>Ghi nhận thu học phí</h1><p class="muted">Kiểm tra đúng học sinh và công nợ trước khi ghi nhận khoản thu.</p></div><a class="secondary" routerLink="/finance/tuition">Quay lại học phí</a></section>
    <form class="card form-card" (ngSubmit)="save()">
      <label>Chọn ledger học phí *<select name="ledger" [(ngModel)]="form.ledger_id"><option value="">Chọn học sinh</option>@for(l of ledgers;track l.id){<option [value]="l.id">{{l.enrollment?.student?.full_name}} · {{l.enrollment?.class?.code || 'Chưa có lớp'}} · còn {{money(l.debt_amount)}}</option>}</select></label>
      @if(selectedLedger(); as ledger){
        <section class="payment-context" aria-label="Thông tin công nợ trước khi thu"><div><span>Học sinh</span><strong>{{ledger.enrollment?.student?.full_name || '—'}}</strong></div><div><span>Lớp</span><strong>{{ledger.enrollment?.class?.code || '—'}} · {{ledger.enrollment?.class?.name || '—'}}</strong></div><div><span>Phải thu</span><strong>{{money(ledger.amount_due)}}</strong></div><div><span>Đã thu</span><strong>{{money(ledger.paid_amount)}}</strong></div><div><span>Còn nợ</span><strong class="danger-text">{{money(ledger.debt_amount)}}</strong></div></section>
        @if(amountExceedsDebt()){<div class="alert">Số tiền nhập lớn hơn công nợ hiện tại. Hãy kiểm tra lại trước khi ghi; quy tắc overpayment vẫn được server kiểm soát.</div>}
      } @else { <p class="muted form-help">Khi đi từ Ledger lớp, hệ thống sẽ tự chọn đúng học sinh bằng mã ledger trên URL.</p> }
      <div class="form-grid"><label>Số tiền (VND) *<input type="number" min="1" step="1" name="amount" [(ngModel)]="form.amount" required /></label><label>Ngày thu *<input type="datetime-local" name="paid_at" [(ngModel)]="form.paid_at" required /></label><label>Phương thức<select name="method" [(ngModel)]="form.method"><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option><option value="OTHER">Khác</option></select></label><label>Tham chiếu<input name="reference" [(ngModel)]="form.reference" placeholder="Mã giao dịch" /></label><label class="full">Ghi chú<input name="note" [(ngModel)]="form.note" /></label></div>
      @if(error){<div class="alert">{{error}}</div>}<div class="form-actions"><button class="primary" [disabled]="saving || !form.ledger_id">{{saving?'Đang ghi…':'Ghi nhận thanh toán'}}</button><a class="secondary" routerLink="/finance/tuition">Hủy</a></div>
    </form>
  `,
})
export class PaymentFormComponent implements OnInit {
  ledgers: any[] = [];
  saving = false;
  error = '';
  form = { ledger_id: '', amount: 0, paid_at: new Date().toISOString().slice(0, 16), method: 'CASH', reference: '', note: '' };

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly supabase: SupabaseService, private readonly edge: EdgeFunctionService, private readonly toast: ToastService) {}

  ngOnInit() {
    const queryId = this.route.snapshot.queryParamMap.get('ledgerId');
    if (queryId) this.form.ledger_id = queryId;
    void this.load();
  }

  async load() {
    const result = await this.supabase.client.from('tuition_ledgers').select('id,debt_amount,amount_due,paid_amount,status,enrollment:enrollments(student:students(full_name),class:classes(code,name))').order('debt_amount', { ascending: false });
    if (result.error) this.error = result.error.message;
    else this.ledgers = result.data || [];
  }

  selectedLedger(): any | null { return this.ledgers.find((ledger) => ledger.id === this.form.ledger_id) || null; }
  amountExceedsDebt(): boolean { const ledger = this.selectedLedger(); return !!ledger && Number(this.form.amount || 0) > Number(ledger.debt_amount || 0); }

  async save() {
    this.error = '';
    if (!this.form.ledger_id || !Number.isSafeInteger(Number(this.form.amount)) || Number(this.form.amount) <= 0) { this.error = 'Chọn ledger và nhập số tiền nguyên dương.'; return; }
    this.saving = true;
    try {
      await this.edge.invoke('record-payment', { ledger_id: this.form.ledger_id, amount: Number(this.form.amount), paid_at: new Date(this.form.paid_at).toISOString(), method: this.form.method, reference: this.form.reference, note: this.form.note });
      this.toast.success('Đã ghi nhận thanh toán.');
      await this.router.navigateByUrl('/finance/tuition');
    } catch (e) { this.error = e instanceof Error ? e.message : 'Không thể ghi nhận thanh toán.'; }
    finally { this.saving = false; }
  }

  money(v: unknown) { return formatMoney(Number(v || 0)); }
}
