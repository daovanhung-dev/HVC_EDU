import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinancialTransaction, MinimalService, TransactionType } from '../../core/services/minimal.service';
import { ToastService } from '../../core/services/toast.service';
import { formatMoney, parseMoney } from '../../core/utils/money.util';

type TransactionForm = { transaction_date: string; type: TransactionType; category: string; description: string; amount: string };
const blankForm = (): TransactionForm => ({ transaction_date: MinimalService.iso(new Date()), type: 'INCOME', category: '', description: '', amount: '' });

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">THU CHI</p><h1>Sổ thu chi</h1><p class="page-description muted">Ghi nhận các khoản thu, khoản chi và xem tổng doanh thu theo khoảng ngày.</p></div></section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    <form class="card form-card" (ngSubmit)="save()"><div class="panel-heading"><h2>Ghi nhận giao dịch</h2></div><div class="form-grid"><label>Ngày<input type="date" name="date" [(ngModel)]="form.transaction_date" required /></label><label>Loại<select name="type" [(ngModel)]="form.type"><option value="INCOME">Khoản thu</option><option value="EXPENSE">Khoản chi</option></select></label><label>Danh mục<input name="category" [(ngModel)]="form.category" placeholder="Ví dụ: học phí, điện nước" required /></label><label>Số tiền VND<input name="amount" inputmode="numeric" [(ngModel)]="form.amount" placeholder="0" required /></label><label class="span-2">Nội dung<input name="description" [(ngModel)]="form.description" required /></label></div><div class="form-actions"><button class="primary" type="submit" [disabled]="saving">{{ saving ? 'Đang lưu…' : 'Lưu giao dịch' }}</button></div></form>
    <div class="toolbar card compact-toolbar"><label>Từ ngày<input type="date" [(ngModel)]="fromDate" /></label><label>Đến ngày<input type="date" [(ngModel)]="toDate" /></label><button class="primary" type="button" [disabled]="loading()" (click)="load()">Xem</button></div>
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải sổ thu chi…</span></section> } @else { <section class="kpi-grid"><article class="card metric-card metric-money"><span>Tổng doanh thu</span><strong>{{ money(income()) }}</strong></article><article class="card metric-card metric-money"><span>Tổng chi</span><strong>{{ money(expense()) }}</strong></article><article class="card metric-card metric-money"><span>Số dư</span><strong [class.danger-text]="balance() < 0">{{ money(balance()) }}</strong></article></section><section class="card section-card section-heading-spaced"><div class="panel-heading"><div><p class="eyebrow">GIAO DỊCH</p><h2>{{ transactions().length }} giao dịch</h2></div></div><div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Loại</th><th>Danh mục</th><th>Nội dung</th><th class="number-cell">Số tiền</th></tr></thead><tbody>@for (item of transactions(); track item.id) { <tr><td>{{ item.transaction_date }}</td><td>{{ item.type === 'INCOME' ? 'Thu' : 'Chi' }}</td><td>{{ item.category }}</td><td>{{ item.description }}</td><td class="number-cell" [class.danger-text]="item.type === 'EXPENSE'">{{ item.type === 'EXPENSE' ? '-' : '+' }}{{ money(item.amount) }}</td></tr> } @empty { <tr><td colspan="5" class="empty">Chưa có giao dịch trong khoảng ngày.</td></tr> }</tbody></table></div></section> }
  `,
})
export class FinanceComponent implements OnInit {
  readonly transactions = signal<FinancialTransaction[]>([]); readonly loading = signal(true); readonly error = signal(''); form = blankForm(); fromDate = MinimalService.currentMonth().from; toDate = MinimalService.currentMonth().to; saving = false;
  constructor(private readonly minimal: MinimalService, private readonly toast: ToastService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { this.transactions.set(await this.minimal.listTransactions(this.fromDate, this.toDate)); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải sổ thu chi.'); } finally { this.loading.set(false); } }
  income(): number { return this.transactions().filter((item) => item.type === 'INCOME').reduce((sum, item) => sum + Number(item.amount || 0), 0); }
  expense(): number { return this.transactions().filter((item) => item.type === 'EXPENSE').reduce((sum, item) => sum + Number(item.amount || 0), 0); }
  balance(): number { return this.income() - this.expense(); }
  money(value: unknown): string { return formatMoney(Number(value || 0)); }
  async save(): Promise<void> { const amount = parseMoney(this.form.amount); if (!this.form.category.trim() || !this.form.description.trim() || !Number.isSafeInteger(amount) || amount <= 0) { this.error.set('Danh mục, nội dung và số tiền phải hợp lệ; số tiền là số nguyên VND dương.'); return; } this.saving = true; this.error.set(''); try { await this.minimal.recordTransaction({ transaction_date: this.form.transaction_date, type: this.form.type, category: this.form.category, description: this.form.description, amount }); this.toast.success('Đã ghi nhận giao dịch.'); this.form = blankForm(); await this.load(); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể ghi nhận giao dịch.'); } finally { this.saving = false; } }
}
