import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { ToastService } from '../../core/services/toast.service';

@Component({ selector: 'app-migration', standalone: true, imports: [CommonModule], template: `
<section class="page-header"><div><p class="eyebrow">HỆ THỐNG</p><h1>Nhập workbook Excel</h1><p class="muted">Upload private, validate server-side, chặn #REF! và xem reconciliation trước khi import.</p></div></section>
<section class="card form-card"><input type="file" accept=".xlsx,.xls,.csv" (change)="select($event)" />@if(fileName){<p>Đã chọn: <strong>{{fileName}}</strong></p>}<div class="form-actions"><button class="primary" [disabled]="!fileData||loading" (click)="validate()">{{loading?'Đang xử lý…':'Validate workbook'}}</button>@if(result?.status==='READY'){<button class="secondary" [disabled]="loading" (click)="importData()">Import dữ liệu</button>}@if(result){<button class="secondary" [disabled]="loading" (click)="reconcile()">Reconcile</button>}</div>@if(error){<div class="alert">{{error}}</div>}@if(result){<h2>Kết quả</h2><p>Status: <strong>{{result.status}}</strong> · {{result.summary?.issue_count||0}} issue</p><div class="table-wrap"><table><thead><tr><th>Sheet</th><th>Rows</th><th>Sample</th></tr></thead><tbody>@for(s of result.summary?.sheets||[];track s.sheet_name){<tr><td>{{s.sheet_name}}</td><td>{{s.row_count}}</td><td><code>{{s.sample|json}}</code></td></tr>}</tbody></table></div><p class="muted">Chỉ import sau khi validation không còn lỗi; mọi #REF! phải được xử lý ở nguồn.</p>}</section>
` })
export class MigrationComponent {
  fileName = '';
  fileData = '';
  loading = false;
  error = '';
  result: any = null;
  constructor(private readonly edge: EdgeFunctionService, private readonly toast: ToastService) {}

  select(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; this.fileName = file.name; const reader = new FileReader(); reader.onload = () => { this.fileData = String(reader.result).split(',')[1] || ''; }; reader.readAsDataURL(file); }

  async validate() { await this.run({ file_name: this.fileName, file_base64: this.fileData, mode: 'VALIDATE' }); }
  async importData() { if (!this.result?.import_job_id) return; await this.run({ import_job_id: this.result.import_job_id, mode: 'IMPORT' }); }
  async reconcile() { if (!this.result?.import_job_id) return; await this.run({ import_job_id: this.result.import_job_id, mode: 'RECONCILE' }); }

  private async run(payload: Record<string, unknown>) {
    this.loading = true; this.error = '';
    try { this.result = await this.edge.invoke('import-center-workbook', payload); this.toast.success(`Import status: ${this.result.status}`); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Không thể xử lý workbook.'; }
    finally { this.loading = false; }
  }
}
