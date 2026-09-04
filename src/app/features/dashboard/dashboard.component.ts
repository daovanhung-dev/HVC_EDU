import { Component, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';

type DashboardSummary = {
  activeClasses: number;
  activeStudents: number;
  totalDue: number;
  totalPaid: number;
  totalDebt: number;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <section class="page-header">
      <div><p class="eyebrow">QUẢN TRỊ</p><h1>Tổng quan trung tâm</h1></div>
      <button class="secondary" type="button" (click)="load()">Làm mới</button>
    </section>

    @if (error()) { <div class="alert">{{ error() }}</div> }

    <section class="kpi-grid">
      <article class="card"><span>Lớp đang hoạt động</span><strong>{{ data().activeClasses }}</strong></article>
      <article class="card"><span>Học sinh đang học</span><strong>{{ data().activeStudents }}</strong></article>
      <article class="card"><span>Phải thu</span><strong>{{ money(data().totalDue) }}</strong></article>
      <article class="card"><span>Đã thu</span><strong>{{ money(data().totalPaid) }}</strong></article>
      <article class="card"><span>Công nợ</span><strong>{{ money(data().totalDebt) }}</strong></article>
    </section>

    <section class="card section-card">
      <h2>Trạng thái khởi tạo</h2>
      <p class="muted">Project đã có Auth, RLS schema, module khung và Edge Function mẫu. Tiếp theo triển khai nghiệp vụ theo BD trong thư mục docs.</p>
    </section>
  `,
})
export class DashboardComponent implements OnInit {
  readonly data = signal<DashboardSummary>({ activeClasses: 0, activeStudents: 0, totalDue: 0, totalPaid: 0, totalDebt: 0 });
  readonly error = signal('');

  constructor(private readonly supabase: SupabaseService) {}

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.error.set('');
    const { data, error } = await this.supabase.client.functions.invoke<DashboardSummary>('dashboard-summary', { body: {} });
    if (error) {
      this.error.set('Chưa tải được dashboard. Hãy chạy migration + deploy Edge Function.');
      return;
    }
    if (data) this.data.set(data);
  }

  money(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  }
}
