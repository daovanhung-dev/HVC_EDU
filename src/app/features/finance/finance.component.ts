import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { TuitionComponent } from './tuition.component';
import { PaymentFormComponent } from './payment-form.component';
import { DebtsComponent } from './debts.component';
import { TransactionsComponent } from './transactions.component';
import { RewardsComponent } from './rewards.component';
import { PayrollComponent } from './payroll.component';
import { FundProfitComponent } from './fund-profit.component';

type FinanceTab = 'overview' | 'tuition' | 'payment' | 'debts' | 'transactions' | 'rewards' | 'payroll' | 'profit';
type FinanceLink = { tab: Exclude<FinanceTab, 'overview'>; label: string; description: string; icon: string };

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [RouterLink, AppIconComponent, PageHeaderComponent, TuitionComponent, PaymentFormComponent, DebtsComponent, TransactionsComponent, RewardsComponent, PayrollComponent, FundProfitComponent],
  template: `
    <app-page-header eyebrow="KẾ TOÁN" title="Trung tâm tài chính" description="Học phí, thu chi, payroll và lợi nhuận được gom vào một workflow theo tab." />
    <nav class="hub-tabs" aria-label="Các tab kế toán"><a [class.active]="tab() === 'overview'" routerLink="/finance">Tổng quan</a>@for(item of links; track item.tab){<a [class.active]="tab() === item.tab" [routerLink]="['/finance']" [queryParams]="{ tab: item.tab }">{{ item.label }}</a>}</nav>
    @if (tab() === 'overview') { <section class="finance-guide card"><div class="finance-guide-icon"><app-icon name="tuition" /></div><div><strong>Quy trình trong tháng</strong><p class="muted">Kiểm tra học phí → ghi nhận payment → theo dõi công nợ → xử lý payroll → đối soát thu/chi → xem quỹ và lợi nhuận.</p></div></section><section class="function-grid">@for(item of links; track item.tab){<a class="function-card card" [routerLink]="['/finance']" [queryParams]="{ tab: item.tab }"><span class="function-card-icon"><app-icon [name]="item.icon" /></span><span class="function-card-content"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span><span class="function-card-arrow">→</span></a>}</section> }
    @else { <a class="button-link back-link" routerLink="/finance">← Về tổng quan kế toán</a>@switch (tab()) { @case ('tuition') { <app-tuition /> } @case ('payment') { <app-payment-form /> } @case ('debts') { <app-debts /> } @case ('transactions') { <app-transactions /> } @case ('rewards') { <app-rewards /> } @case ('payroll') { <app-payroll /> } @case ('profit') { <app-fund-profit /> } } }
  `,
})
export class FinanceComponent implements OnInit {
  readonly tab = signal<FinanceTab>('overview');
  readonly links: FinanceLink[] = [
    { tab: 'tuition', label: 'Học phí', description: 'Phải thu, đã thu và ledger theo lớp', icon: 'tuition' },
    { tab: 'payment', label: 'Ghi nhận payment', description: 'Ghi nhận khoản thu học phí', icon: 'payment' },
    { tab: 'debts', label: 'Công nợ & chuyển kỳ', description: 'Nợ đầu kỳ, điều chỉnh và carry-over', icon: 'debt' },
    { tab: 'transactions', label: 'Thu/chi khác', description: 'Giao dịch ngoài học phí', icon: 'transactions' },
    { tab: 'rewards', label: 'Thưởng học sinh', description: 'Quản lý khoản thưởng theo kỳ', icon: 'reward' },
    { tab: 'payroll', label: 'Payroll', description: 'Preview, lưu draft và duyệt lương', icon: 'payroll' },
    { tab: 'profit', label: 'Quỹ & lợi nhuận', description: 'Trích quỹ và phân phối lợi nhuận', icon: 'profit' },
  ];
  constructor(private readonly route: ActivatedRoute) {}
  ngOnInit(): void { this.route.queryParamMap.subscribe((params) => { const value = params.get('tab') as FinanceTab | null; this.tab.set(value && this.links.some((item) => item.tab === value) ? value : 'overview'); }); }
}
