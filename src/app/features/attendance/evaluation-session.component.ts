import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EvaluationRow, ClassSession, MinimalService } from '../../core/services/minimal.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-evaluation-session',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    @if (loading()) { <section class="card loading-state"><span class="loading-spinner"></span><span>Đang tải nhận xét…</span></section> } @else if (error()) { <div class="alert">{{ error() }}</div> } @else if (session()) { <section class="page-header"><div><p class="eyebrow">NHẬN XÉT</p><h1>{{ session()!.class?.name || 'Buổi học' }}</h1><p class="muted">{{ session()!.session_date }} · Nhận xét theo từng học sinh</p></div><a class="secondary" [routerLink]="['/classes', classId, 'sessions', sessionId, 'attendance']">Điểm danh</a></section><section class="card section-card"><div class="panel-heading"><div><h2>Nhận xét học sinh</h2><p class="muted">Để trống nếu chưa cần nhận xét.</p></div><button class="primary" type="button" [disabled]="saving" (click)="save()">{{ saving ? 'Đang lưu…' : 'Lưu nhận xét' }}</button></div><div class="table-wrap"><table><thead><tr><th>Mã HS</th><th>Họ tên</th><th>Nhận xét</th></tr></thead><tbody>@for (row of rows(); track row.enrollment_id) { <tr><td>{{ row.student.code }}</td><td>{{ row.student.full_name }}</td><td><textarea [name]="'comment_' + row.enrollment_id" rows="2" [(ngModel)]="row.comment" placeholder="Nhận xét ngắn"></textarea></td></tr> } @empty { <tr><td colspan="3" class="empty">Không có học sinh active tại buổi này.</td></tr> }</tbody></table></div></section> }
  `,
})
export class EvaluationSessionComponent implements OnInit {
  readonly session = signal<ClassSession | null>(null); readonly rows = signal<EvaluationRow[]>([]); readonly loading = signal(true); readonly error = signal(''); saving = false; classId = ''; sessionId = '';
  constructor(private readonly route: ActivatedRoute, private readonly minimal: MinimalService, private readonly toast: ToastService) {}
  ngOnInit(): void { this.classId = this.route.snapshot.paramMap.get('classId') || ''; this.sessionId = this.route.snapshot.paramMap.get('sessionId') || ''; void this.load(); }
  async load(): Promise<void> { this.loading.set(true); this.error.set(''); try { const data = await this.minimal.sessionRoster(this.sessionId); this.session.set(data.session); this.rows.set(data.evaluations); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể tải nhận xét.'); } finally { this.loading.set(false); } }
  async save(): Promise<void> { this.saving = true; try { await this.minimal.saveEvaluations(this.sessionId, this.rows()); this.toast.success('Đã lưu nhận xét.'); } catch (error) { this.error.set(error instanceof Error ? error.message : 'Không thể lưu nhận xét.'); } finally { this.saving = false; } }
}
