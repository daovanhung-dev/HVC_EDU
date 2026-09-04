import { Component, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { formatMoney } from '../../core/utils/money.util';
@Component({selector:'app-class-report',standalone:true,template:`
<section class="page-header"><div><p class="eyebrow">BÁO CÁO</p><h1>Báo cáo theo lớp</h1></div><button class="secondary" (click)="load()">Làm mới</button></section>@if(error()){<div class="alert">{{error()}}</div>}<div class="card table-wrap"><table><thead><tr><th>Lớp</th><th>Roster</th><th>Buổi</th><th>Phải thu</th><th>Đã thu</th><th>Nợ</th></tr></thead><tbody>@for(r of rows();track r.class_id){<tr><td>{{r.code}} · {{r.name}}</td><td>{{r.roster_count}}</td><td>{{r.session_count}}</td><td>{{money(r.total_due)}}</td><td>{{money(r.total_paid)}}</td><td class="danger">{{money(r.total_debt)}}</td></tr>}@empty{<tr><td colspan="6" class="empty">Chưa có dữ liệu báo cáo.</td></tr>}</tbody></table></div>
`})
export class ClassReportComponent implements OnInit{rows=signal<any[]>([]);error=signal('');constructor(private readonly supabase:SupabaseService,readonly period:PeriodContextService){}ngOnInit(){void this.load();}async load(){const p=this.period.current();if(!p)return;const r=await this.supabase.client.from('v_class_period_summary').select('*').eq('period_id',p.id).order('grade');if(r.error)this.error.set(r.error.message);else this.rows.set(r.data||[]);}money(v:unknown){return formatMoney(Number(v||0));}}
