import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { formatMoney } from '../../core/utils/money.util';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';

type CenterClass = { id: string; code: string; name: string; grade: number; subject: string; standard_unit_fee: number; collection_method: string; status: string };

@Component({ selector: 'app-classes', standalone: true, imports: [FormsModule, RouterLink, StatusBadgeComponent, LoadingStateComponent], template: `
<section class="page-header"><div><p class="eyebrow">ĐÀO TẠO</p><h1>Lớp học</h1><p class="muted">Quản lý lớp, lịch tuần và roster theo kỳ.</p></div>@if(auth.role()==='ADMIN'){<a class="primary" routerLink="/classes/new">+ Tạo lớp</a>}</section>
@if(error()){<div class="alert">{{error()}}</div>}<div class="toolbar"><label>Tìm kiếm<input [(ngModel)]="search" placeholder="Mã hoặc tên lớp" /></label><label>Khối<select [(ngModel)]="grade"><option value="">Tất cả</option>@for(item of grades;track item){<option [value]="item">{{item}}</option>}</select></label><button class="secondary" type="button" [disabled]="loading()" (click)="load()">{{loading()?'Đang tải…':'Làm mới'}}</button></div>
@if(loading()){<app-loading-state label="Đang tải danh sách lớp…" />}@else{<div class="card table-wrap"><table><thead><tr><th>Mã</th><th>Tên lớp</th><th>Khối</th><th>Môn</th><th>Học phí/buổi</th><th>Cách thu</th><th>Trạng thái</th><th></th></tr></thead><tbody>@for(item of filtered();track item.id){<tr><td><a class="button-link" [routerLink]="['/classes',item.id]">{{item.code}}</a></td><td>{{item.name}}</td><td>{{item.grade}}</td><td>{{item.subject}}</td><td>{{money(item.standard_unit_fee)}}</td><td>{{item.collection_method==='PREPAID'?'Thu trước':'Theo buổi'}}</td><td><app-status-badge [value]="item.status" /></td><td><a class="button-link" [routerLink]="['/classes',item.id,'schedule']">Lịch</a></td></tr>}@empty{<tr><td colspan="8" class="empty">Chưa có lớp trong phạm vi quyền hiện tại.</td></tr>}</tbody></table></div>}
` })
export class ClassesComponent implements OnInit {
  readonly items = signal<CenterClass[]>([]); readonly error = signal(''); readonly loading = signal(true); search = ''; grade = ''; readonly grades = [1,2,3,4,5,6,7,8,9,10,11,12];
  constructor(private readonly supabase: SupabaseService, readonly auth: AuthService) {}
  ngOnInit() { void this.load(); }
  async load() { this.error.set(''); this.loading.set(true); try { const { data, error } = await this.supabase.client.from('classes').select('id,code,name,grade,subject,standard_unit_fee,collection_method,status').order('grade'); if (error) this.error.set(error.message); else this.items.set((data ?? []) as CenterClass[]); } finally { this.loading.set(false); } }
  filtered() { const needle = this.search.trim().toLowerCase(); return this.items().filter((item) => (!needle || `${item.code} ${item.name}`.toLowerCase().includes(needle)) && (!this.grade || String(item.grade) === this.grade)); }
  money(value: number) { return formatMoney(value); }
}
