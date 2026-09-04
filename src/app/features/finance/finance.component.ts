import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

type FinanceLink = { path: string; label: string; description: string; icon: string };

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [RouterLink, AppIconComponent, PageHeaderComponent],
  template: `
    <app-page-header eyebrow="TÀI CHÍNH" title="Trung tâm tài chính" description="Chọn đúng nghiệp vụ cần xử lý trong kỳ đang làm việc." />
    <section class="finance-guide card">
      <div class="finance-guide-icon"><app-icon name="tuition" /></div>
      <div><strong>Quy trình đề xuất</strong><p class="muted">Kiểm tra học phí → ghi nhận payment → theo dõi công nợ → xử lý payroll → xem quỹ và lợi nhuận.</p></div>
    </section>
    <section class="section-heading"><div><p class="eyebrow">CÁC PHÂN HỆ</p><h2>Chức năng tài chính</h2><p class="muted">Mỗi mục có mô tả ngắn để bạn biết nên bắt đầu từ đâu.</p></div></section>
    <section class="function-grid">
      @for (item of links; track item.path) {
        <a class="function-card card" [routerLink]="item.path">
          <span class="function-card-icon"><app-icon [name]="item.icon" /></span>
          <span class="function-card-content"><strong>{{ item.label }}</strong><small>{{ item.description }}</small></span>
          <span class="function-card-arrow" aria-hidden="true">→</span>
        </a>
      }
    </section>
  `,
})
export class FinanceComponent {
  readonly links: FinanceLink[] = [
    { path: '/finance/tuition', label: 'Học phí', description: 'Phải thu, đã thu và ledger theo lớp', icon: 'tuition' },
    { path: '/finance/payments/new', label: 'Ghi nhận payment', description: 'Ghi nhận khoản thu học phí', icon: 'payment' },
    { path: '/finance/debts', label: 'Công nợ & chuyển kỳ', description: 'Nợ đầu kỳ, điều chỉnh và carry-over', icon: 'debt' },
    { path: '/finance/transactions', label: 'Thu/chi khác', description: 'Giao dịch ngoài học phí', icon: 'transactions' },
    { path: '/finance/rewards', label: 'Thưởng học sinh', description: 'Quản lý khoản thưởng theo kỳ', icon: 'reward' },
    { path: '/payroll', label: 'Payroll', description: 'Preview, lưu draft và duyệt lương', icon: 'payroll' },
    { path: '/finance/fund-profit', label: 'Quỹ & lợi nhuận', description: 'Trích quỹ và phân phối lợi nhuận', icon: 'profit' },
  ];
}
