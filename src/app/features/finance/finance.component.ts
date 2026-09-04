import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [RouterLink],
  template: `<section class="page-header"><div><p class="eyebrow">TÀI CHÍNH</p><h1>Học phí & công nợ</h1><p class="muted">Chọn phân hệ cần thao tác.</p></div></section><div class="grid-3"><a class="card section-card link-card" routerLink="/finance/tuition"><h2>Học phí</h2><p class="muted">Tổng quan phải thu, đã thu và công nợ.</p></a><a class="card section-card link-card" routerLink="/finance/debts"><h2>Công nợ</h2><p class="muted">Nợ đầu kỳ, điều chỉnh và carry-over.</p></a><a class="card section-card link-card" routerLink="/finance/transactions"><h2>Thu/chi khác</h2><p class="muted">Giao dịch ngoài học phí có audit.</p></a></div>`,
})
export class FinanceComponent {}
