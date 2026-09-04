import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { formatMoney } from '../../core/utils/money.util';

type Summary = {
  period: { month: number; year: number; status: string } | null;
  activeClasses: number; activeStudents: number; totalDue: number; totalPaid: number; totalDebt: number;
  payrollTotal: number; otherIncome: number; otherExpense: number; rewards: number;
  profitBeforeFund: number; fundContribution: number; distributableProfit: number; alerts: string[]; role: string;
};

@Component({ selector: 'app-dashboard', standalone: true, imports: [RouterLink], template: `
<section class="page-header"><div><p class="eyebrow">QUẢN TRỊ</p><h1>Tổng quan trung tâm</h1><p class="muted">{{data().period ? ('Kỳ '+data().period?.month+'/'+data().period?.year) : 'Chưa có kỳ kế toán'}}</p></div><button class="secondary" (click)="load()">Làm mới</button></section>
@if(error()){<div class="alert">{{error()}}</div>}
<section class="kpi-grid"><article class="card"><span>Lớp đang hoạt động</span><strong>{{data().activeClasses}}</strong></article><article class="card"><span>Học sinh đang học</span><strong>{{data().activeStudents}}</strong></article>
@if(financeVisible()){<article class="card"><span>Phải thu</span><strong>{{money(data().totalDue)}}</strong></article><article class="card"><span>Đã thu</span><strong>{{money(data().totalPaid)}}</strong></article><article class="card"><span>Công nợ</span><strong>{{money(data().totalDebt)}}</strong></article><article class="card"><span>Payroll</span><strong>{{money(data().payrollTotal)}}</strong></article><article class="card"><span>Thu khác</span><strong>{{money(data().otherIncome)}}</strong></article><article class="card"><span>Chi khác</span><strong>{{money(data().otherExpense + data().rewards)}}</strong></article><article class="card"><span>Lợi nhuận trước quỹ</span><strong>{{money(data().profitBeforeFund)}}</strong></article><article class="card"><span>Trích quỹ</span><strong>{{money(data().fundContribution)}}</strong></article><article class="card"><span>Lợi nhuận phân phối</span><strong>{{money(data().distributableProfit)}}</strong></article>}
@else{<article class="card"><span>Vai trò</span><strong>{{auth.role()}}</strong></article>}</section>
<section class="grid-2"><section class="card section-card"><h2>Thao tác nhanh</h2><div class="stat-list"><div><span>Điểm danh</span><a class="button-link" routerLink="/attendance">Mở danh sách buổi</a></div><div><span>Lớp học</span><a class="button-link" routerLink="/classes">Xem lớp</a></div>@if(financeVisible()){<div><span>Học phí</span><a class="button-link" routerLink="/finance/tuition">Mở học phí</a></div>}</div></section><section class="card section-card"><h2>Cảnh báo</h2>@for(alert of data().alerts;track alert){<p class="danger">{{alert}}</p>}@empty{<p class="success">Không có cảnh báo mới.</p>}</section></section>
` })
export class DashboardComponent implements OnInit {
  data = signal<Summary>({ period: null, activeClasses: 0, activeStudents: 0, totalDue: 0, totalPaid: 0, totalDebt: 0, payrollTotal: 0, otherIncome: 0, otherExpense: 0, rewards: 0, profitBeforeFund: 0, fundContribution: 0, distributableProfit: 0, alerts: [], role: '' });
  error = signal('');
  constructor(private readonly edge: EdgeFunctionService, readonly period: PeriodContextService, readonly auth: AuthService) {}
  ngOnInit() { void this.load(); }
  async load() { try { await this.period.ready; const period = this.period.current(); this.data.set(await this.edge.invoke<Summary>('dashboard-summary', period ? { period_id: period.id } : {})); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Chưa tải được dashboard.'); } }
  financeVisible() { return ['ADMIN', 'ACCOUNTANT'].includes(this.auth.role() || ''); }
  money(value: unknown) { return formatMoney(Number(value || 0)); }
}
