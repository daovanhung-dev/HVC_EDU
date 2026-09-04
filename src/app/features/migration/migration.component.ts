import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { ToastService } from '../../core/services/toast.service';
import { statusLabel } from '../../core/utils/status.util';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

@Component({ selector: 'app-migration', standalone: true, imports: [CommonModule, AppIconComponent, PageHeaderComponent, StatusBadgeComponent], template: `
<app-page-header eyebrow="HỆ THỐNG" title="Nhập dữ liệu" description="Đưa workbook vào hệ thống theo quy trình Validate → Review → Import → Reconcile.">
  <span class="page-header-meta"><app-icon name="upload" /> Dữ liệu chỉ được ghi sau bước kiểm tra</span>
</app-page-header>
<section class="workflow-stepper card" aria-label="Tiến trình nhập dữ liệu">
  <div class="workflow-step" [class.active]="currentStep() === 1"><span>1</span><div><strong>Validate</strong><small>Kiểm tra cấu trúc và dữ liệu</small></div></div>
  <div class="workflow-line"></div>
  <div class="workflow-step" [class.active]="currentStep() === 2"><span>2</span><div><strong>Review issues</strong><small>Rà soát lỗi và cảnh báo</small></div></div>
  <div class="workflow-line"></div>
  <div class="workflow-step" [class.active]="currentStep() === 3"><span>3</span><div><strong>Import</strong><small>Ghi dữ liệu theo job</small></div></div>
  <div class="workflow-line"></div>
  <div class="workflow-step" [class.active]="currentStep() === 4"><span>4</span><div><strong>Reconcile</strong><small>Đối soát sau khi ghi</small></div></div>
</section>
<section class="card form-card">
  <div class="section-heading"><div><h2>Chọn workbook</h2><p class="muted">File được upload riêng tư và validation chạy ở server.</p></div><app-status-badge [value]="result?.status || 'READY'" /></div>
  <label class="file-picker"><app-icon name="upload" /><span><strong>{{fileName || 'Chọn file Excel hoặc CSV'}}</strong><small>.xlsx, .xls hoặc .csv</small></span><input type="file" accept=".xlsx,.xls,.csv" (change)="select($event)" /></label>
  <div class="form-actions"><button class="primary" [disabled]="!fileData||loading" (click)="validate()"><app-icon name="check" />{{loading?'Đang xử lý…':'Validate workbook'}}</button>@if(result?.status==='READY'){<button class="secondary" [disabled]="loading" (click)="importData()"><app-icon name="upload" />Import dữ liệu</button>}@if(result){<button class="secondary" [disabled]="loading" (click)="reconcile()"><app-icon name="refresh" />Reconcile</button>}</div>
  @if(error){<div class="alert">{{error}}</div>}
  @if(result){<div class="result-summary"><div><span>Trạng thái</span><app-status-badge [value]="result.status" /></div><div><span>Số vấn đề</span><strong>{{result.summary?.issue_count||0}}</strong></div></div><div class="table-wrap"><table><thead><tr><th>Sheet</th><th>Số dòng</th><th>Mẫu dữ liệu</th></tr></thead><tbody>@for(s of result.summary?.sheets||[];track s.sheet_name){<tr><td>{{s.sheet_name}}</td><td>{{s.row_count}}</td><td><code>{{s.sample|json}}</code></td></tr>}</tbody></table></div><p class="muted">Chỉ import sau khi validation không còn lỗi; mọi #REF! phải được xử lý ở nguồn.</p>}
</section>
` })
export class MigrationComponent {
  fileName = '';
  fileData = '';
  loading = false;
  error = '';
  result: any = null;
  constructor(private readonly edge: EdgeFunctionService, private readonly toast: ToastService) {}

  currentStep(): number {
    switch (this.result?.status) {
      case 'READY': return 2;
      case 'IMPORTED': return 4;
      case 'RECONCILED': return 4;
      case 'FAILED': return 2;
      default: return this.result ? 2 : 1;
    }
  }

  statusLabel(value: string | null | undefined) { return statusLabel(value); }

  select(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; this.fileName = file.name; const reader = new FileReader(); reader.onload = () => { this.fileData = String(reader.result).split(',')[1] || ''; }; reader.readAsDataURL(file); }

  async validate() { await this.run({ file_name: this.fileName, file_base64: this.fileData, mode: 'VALIDATE' }); }
  async importData() { if (!this.result?.import_job_id) return; await this.run({ import_job_id: this.result.import_job_id, mode: 'IMPORT' }); }
  async reconcile() { if (!this.result?.import_job_id) return; await this.run({ import_job_id: this.result.import_job_id, mode: 'RECONCILE' }); }

  private async run(payload: Record<string, unknown>) {
    this.loading = true; this.error = '';
    try { this.result = await this.edge.invoke('import-center-workbook', payload); this.toast.success(`Trạng thái nhập dữ liệu: ${this.statusLabel(this.result.status)}`); }
    catch (error) { this.error = error instanceof Error ? error.message : 'Không thể xử lý workbook.'; }
    finally { this.loading = false; }
  }
}
