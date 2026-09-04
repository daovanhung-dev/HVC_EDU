import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { formatMoney } from '../../core/utils/money.util';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';

@Component({
  selector: 'app-tuition',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent],
  template: `
    <section class="page-header"><div><p class="eyebrow">TÀI CHÍNH</p><h1>Tổng quan học phí</h1><p class="muted">Số liệu lấy từ ledger snapshot của kỳ đang chọn.</p></div><div><button class="secondary" (click)="load()">Làm mới</button><button class="primary" (click)="preview()">Preview học phí</button></div></section>
    @if(error()){<div class="alert">{{error()}}</div>}
    @if(loading()){<app-loading-state label="Đang tổng hợp học phí…" />}<section class="kpi-grid"><article class="metric-card card"><span>Phải thu</span><strong>{{money(totals().total_due)}}</strong><small class="muted">Kỳ đang chọn</small></article><article class="metric-card card"><span>Đã thu</span><strong>{{money(totals().total_paid)}}</strong><small class="muted">{{(rate()*100).toFixed(1)}}% tỷ lệ thu</small></article><article class="metric-card card"><span>Công nợ</span><strong class="danger-text">{{money(totals().total_debt)}}</strong><small class="muted">Cần theo dõi</small></article></section>
    @if(previewRows().length){<section class="card section-card"><h2>Preview theo học sinh</h2><div class="table-wrap"><table><thead><tr><th>Học sinh</th><th>Lớp</th><th>Buổi tính phí</th><th>Đơn giá</th><th>Phải thu</th><th>Nợ</th><th>Cảnh báo</th></tr></thead><tbody>@for(r of previewRows();track r.enrollment_id){<tr><td>{{r.student?.code}} · {{r.student?.full_name}}</td><td>{{r.class?.code}}</td><td>{{r.billable_sessions}}</td><td>{{money(r.unit_price)}}</td><td>{{money(r.amount_due)}}</td><td class="danger">{{money(r.debt_amount)}}</td><td>{{r.warnings.join('; ')||'—'}}</td></tr>}</tbody></table></div></section>}
    <div class="card table-wrap"><table><thead><tr><th>Lớp</th><th>Sĩ số ledger</th><th>Phải thu</th><th>Đã thu</th><th>Nợ</th><th></th></tr></thead><tbody>@for(r of rows();track r.class_id){<tr><td>{{r.code}} · {{r.name}}</td><td>{{r.ledger_count}}</td><td>{{money(r.total_due)}}</td><td>{{money(r.total_paid)}}</td><td class="danger">{{money(r.total_debt)}}</td><td><a class="button-link" [routerLink]="['/finance/tuition',r.class_id]">Chi tiết</a></td></tr>}@empty{<tr><td colspan="6" class="empty">Chưa có ledger. Hãy sinh học phí sau khi có điểm danh.</td></tr>}</tbody></table></div>
  `,
})
export class TuitionComponent implements OnInit {
  rows = signal<any[]>([]);
  previewRows = signal<any[]>([]);
  totals = signal({ total_due: 0, total_paid: 0, total_debt: 0 });
  error = signal('');
  loading = signal(true);

  constructor(private readonly edge: EdgeFunctionService, readonly period: PeriodContextService) {}

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true);
    await this.period.ready;
    const p = this.period.current();
    if (!p) { this.loading.set(false); return; }
    try {
      const result = await this.edge.invoke<any>('tuition-summary', { period_id: p.id });
      this.rows.set(result.rows || []);
      this.totals.set(result.totals || this.totals());
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể tải học phí.'); }
    finally { this.loading.set(false); }
  }

  async preview() {
    await this.period.ready;
    const p = this.period.current();
    if (!p) return;
    try {
      const result = await this.edge.invoke<any>('tuition-preview', { period_id: p.id });
      this.previewRows.set(result.rows || []);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Không thể preview học phí.'); }
  }

  rate() { return this.totals().total_due ? this.totals().total_paid / this.totals().total_due : 1; }
  money(v: unknown) { return formatMoney(Number(v || 0)); }
}
