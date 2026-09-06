import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { formatDate } from '../../core/utils/date.util';
import { roleLabel } from '../../core/utils/status.util';
import { MyClassOverview, MyClassesService } from './my-classes.service';

@Component({
  selector: 'app-my-class-detail',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent],
  template: `
    @if (loading()) { <app-loading-state label="Đang tải thông tin lớp…" /> }
    @else if (error()) { <section class="error-state"><div><strong>Không tải được thông tin lớp</strong><p>{{ error() }}</p></div><button class="secondary" type="button" (click)="load()">Thử lại</button></section> }
    @else if (overview(); as data) {
      <a class="button-link back-link" routerLink="/my-classes">← Quay lại Lớp của tôi</a>
      <section class="page-header app-page-header"><div><p class="eyebrow">LỚP CỦA TÔI</p><h1>{{ data.classInfo.code }} · {{ data.classInfo.name }}</h1><p class="page-description muted">Khối {{ data.classInfo.grade }} · {{ data.classInfo.subject }} · Toàn bộ lịch sử các kỳ.</p></div><button class="secondary" type="button" (click)="load()">Làm mới</button></section>

      <div class="grid-2">
        <section class="card section-card"><h2>Thông tin lớp</h2><div class="stat-list"><div><span>Mã lớp</span><strong>{{ data.classInfo.code }}</strong></div><div><span>Môn học</span><strong>{{ data.classInfo.subject }}</strong></div><div><span>Khối</span><strong>{{ data.classInfo.grade }}</strong></div><div><span>Buổi đã ghi nhận</span><strong>{{ data.sessions.length }}</strong></div></div></section>
        <section class="card section-card"><h2>Vai trò được phân công</h2><div class="stat-list">@for (assignment of data.assignments; track assignment.id) { <div><span>{{ roleLabel(assignment.role) }}</span><strong>{{ formatDate(assignment.start_date) }}{{ assignment.end_date ? ' – ' + formatDate(assignment.end_date) : ' – hiện tại' }}</strong></div>}@empty{<p class="muted">Không có assignment đang hiệu lực.</p>}</div></section>
      </div>

      <section class="card section-card"><div class="panel-heading"><div><h2>Lịch học</h2><p class="muted">Lịch tuần hiện tại và các phiên bản đang hoạt động.</p></div></div><div class="session-list">@for (schedule of data.schedules; track schedule.id) { <div class="session-row"><div class="session-date"><strong>{{ schedule.weekday }}</strong><span>tuần</span></div><div class="session-info"><strong>{{ dayLabel(schedule.weekday) }} · {{ schedule.start_time || 'Cả ngày' }}{{ schedule.end_time ? '–' + schedule.end_time : '' }}</strong><span>Áp dụng từ {{ formatDate(schedule.effective_from) }}{{ schedule.effective_to ? ' đến ' + formatDate(schedule.effective_to) : '' }}</span></div></div>}@empty{<p class="muted">Chưa có lịch học.</p>}</div></section>

      <section class="card section-card"><div class="panel-heading"><div><h2>Học sinh hiện tại ({{ data.students.length }})</h2><p class="muted">Chỉ hiển thị học sinh active trong lớp được phân công.</p></div></div><div class="table-wrap"><table><thead><tr><th>Mã HS</th><th>Họ tên</th><th>Điện thoại</th><th>Phụ huynh</th><th>Ngày vào</th></tr></thead><tbody>@for (student of data.students; track student.enrollment_id) { <tr><td><a class="button-link" [routerLink]="['/students', student.student_id]">{{ student.student?.code || '—' }}</a></td><td>{{ student.student?.full_name || '—' }}</td><td>{{ student.student?.phone || '—' }}</td><td>{{ student.student?.parent_name || '—' }}{{ student.student?.parent_phone ? ' · ' + student.student.parent_phone : '' }}</td><td>{{ formatDate(student.enrolled_from) }}</td></tr>}@empty{<tr><td colspan="5" class="empty">Chưa có học sinh active.</td></tr>}</tbody></table></div></section>

      <section class="card section-card"><div class="panel-heading"><div><h2>Lịch sử điểm danh</h2><p class="muted">Tổng hợp tất cả các buổi đã ghi nhận theo từng học sinh.</p></div></div><div class="table-wrap"><table><thead><tr><th>Học sinh</th><th>Có mặt</th><th>Vắng</th><th>Có phép</th><th>Đã đánh dấu</th></tr></thead><tbody>@for (row of data.attendanceSummary; track row.enrollment_id) { <tr><td>{{ row.student?.code || '—' }} · {{ row.student?.full_name || '—' }}</td><td class="success">{{ row.present_count }}</td><td class="danger">{{ row.absent_count }}</td><td>{{ row.excused_count }}</td><td>{{ row.marked_count }}</td></tr>}@empty{<tr><td colspan="5" class="empty">Chưa có lịch sử điểm danh.</td></tr>}</tbody></table></div></section>

      <section class="card section-card"><div class="panel-heading"><div><h2>Lịch sử nhận xét ({{ data.evaluations.length }})</h2><p class="muted">Nhận xét, lỗ hổng và điểm đánh giá của tất cả các kỳ.</p></div></div><div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Học sinh</th><th>BTVN</th><th>Hiểu bài</th><th>Thái độ</th><th>Lỗ hổng</th><th>Nhận xét</th></tr></thead><tbody>@for (evaluation of data.evaluations; track evaluation.id) { <tr><td>{{ formatDate(evaluation.session_date) }}</td><td>{{ evaluation.student?.code || '—' }} · {{ evaluation.student?.full_name || '—' }}</td><td>{{ score(evaluation.homework_score) }}</td><td>{{ score(evaluation.understanding_score) }}</td><td>{{ score(evaluation.attitude_score) }}</td><td>{{ evaluation.learning_gap || '—' }}</td><td>{{ evaluation.comment || '—' }}</td></tr>}@empty{<tr><td colspan="7" class="empty">Chưa có nhận xét.</td></tr>}</tbody></table></div></section>
    }
  `,
})
export class MyClassDetailComponent implements OnInit {
  readonly overview = signal<MyClassOverview | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  classId = '';

  constructor(private readonly route: ActivatedRoute, private readonly myClasses: MyClassesService) {}

  ngOnInit(): void {
    this.classId = this.route.snapshot.paramMap.get('classId') || '';
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.overview.set(await this.myClasses.getOverview(this.classId));
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error || '');
      this.error.set(message.includes('CLASS_NOT_FOUND') ? 'Không tìm thấy lớp hoặc lớp không còn được phân công cho bạn.' : message || 'Không thể tải thông tin lớp.');
    } finally {
      this.loading.set(false);
    }
  }

  dayLabel(value: number): string { return ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'][Number(value) - 1] || String(value); }
  formatDate(value: string | null | undefined): string { return formatDate(value); }
  roleLabel(value: string | null | undefined): string { return roleLabel(value); }
  score(value: number | string | null): string { return value === null || value === undefined ? '—' : String(value); }
}
