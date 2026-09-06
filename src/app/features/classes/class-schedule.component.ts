import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { EdgeFunctionService } from '../../core/api/edge-function.service';
import { PeriodContextService } from '../../core/services/period-context.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

type ScheduleForm = {
  weekday: number;
  start_time: string;
  end_time: string;
  effective_from: string;
};

@Component({
  selector: 'app-class-schedule',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page-header">
      <div><p class="eyebrow">LỚP HỌC</p><h1>Lịch học & buổi học</h1></div>
      <a class="secondary" [routerLink]="['/classes', id]">Chi tiết lớp</a>
    </section>

    @if (error()) { <div class="alert">{{ error() }}</div> }

    <section class="card section-card">
      <div class="panel-heading">
        <div><h2>Lịch tuần</h2><p class="muted">Sửa lịch sẽ tạo phiên bản mới; các buổi đã sinh vẫn giữ nguyên lịch sử.</p></div>
      </div>
      @if (auth.role() === 'ADMIN') {
        <form class="toolbar" (ngSubmit)="saveSchedule()">
          <label>Thứ
            <select name="weekday" [(ngModel)]="schedule.weekday">
              @for (day of days; track day.value) { <option [ngValue]="day.value">{{ day.label }}</option> }
            </select>
          </label>
          <label>Bắt đầu<input name="start_time" type="time" [(ngModel)]="schedule.start_time" /></label>
          <label>Kết thúc<input name="end_time" type="time" [(ngModel)]="schedule.end_time" /></label>
          <label>Áp dụng từ<input name="effective_from" type="date" [(ngModel)]="schedule.effective_from" [readonly]="!!editingId()" /></label>
          <button class="primary" type="submit" [disabled]="saving()">{{ saving() ? 'Đang lưu…' : (editingId() ? 'Lưu thay đổi' : 'Thêm lịch') }}</button>
          @if (editingId()) { <button class="secondary" type="button" [disabled]="saving()" (click)="cancelEdit()">Hủy</button> }
        </form>
      }

      <div class="session-list">
        @for (item of schedules(); track item.id) {
          <div class="session-row">
            <div class="session-date"><strong>{{ item.weekday }}</strong><span>tuần</span></div>
            <div class="session-info">
              <strong>{{ dayLabel(item.weekday) }} · {{ item.start_time || 'Cả ngày' }}{{ item.end_time ? '–' + item.end_time : '' }}</strong>
              <span class="muted">Áp dụng từ {{ item.effective_from }}{{ item.effective_to ? ' đến ' + item.effective_to : '' }}</span>
            </div>
            @if (auth.role() === 'ADMIN') {
              <div class="session-actions"><button class="button-link" type="button" (click)="editSchedule(item)">Sửa</button></div>
            }
          </div>
        }
        @empty { <p class="muted">Chưa có lịch tuần. Thêm lịch để sinh buổi học.</p> }
      </div>
    </section>

    <section class="card section-card">
      <div class="page-header"><h2>Buổi trong kỳ</h2>@if(auth.role()==='ADMIN'){<button class="primary" [disabled]="!period.current()||generating" (click)="generate()">{{generating?'Đang sinh…':'Sinh buổi theo lịch'}}</button>}</div>
      <div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Giờ</th><th>Trạng thái</th></tr></thead><tbody>@for(item of sessions();track item.id){<tr><td>{{item.session_date}}</td><td>{{item.start_time||'—'}}</td><td><app-status-badge [value]="item.status" /></td></tr>}@empty{<tr><td colspan="3" class="empty">Chưa có buổi. Chọn kỳ rồi sinh buổi.</td></tr>}</tbody></table></div>
    </section>
  `,
})
export class ClassScheduleComponent implements OnInit {
  id = '';
  schedules = signal<any[]>([]);
  sessions = signal<any[]>([]);
  error = signal('');
  editingId = signal<string | null>(null);
  saving = signal(false);
  generating = false;
  schedule: ScheduleForm = this.blankSchedule();
  days = [
    { value: 1, label: 'Thứ 2' }, { value: 2, label: 'Thứ 3' }, { value: 3, label: 'Thứ 4' },
    { value: 4, label: 'Thứ 5' }, { value: 5, label: 'Thứ 6' }, { value: 6, label: 'Thứ 7' }, { value: 7, label: 'Chủ nhật' },
  ];

  constructor(private readonly route: ActivatedRoute, private readonly supabase: SupabaseService, readonly period: PeriodContextService, private readonly edge: EdgeFunctionService, private readonly toast: ToastService, readonly auth: AuthService) {}

  ngOnInit(): void { this.id = this.route.snapshot.paramMap.get('id') || ''; void this.load(); }

  async load(): Promise<void> {
    await this.period.ready;
    this.error.set('');
    const today = this.today();
    const schedules = await this.supabase.client.from('class_schedules').select('*').eq('class_id', this.id).eq('active', true).order('weekday').order('start_time');
    if (schedules.error) this.error.set(this.friendlyError(schedules.error)); else this.schedules.set(schedules.data || []);
    const currentPeriod = this.period.current();
    if (currentPeriod) {
      const sessions = await this.supabase.client.from('class_sessions').select('*').eq('class_id', this.id).eq('period_id', currentPeriod.id).order('session_date');
      if (sessions.error) this.error.set(this.friendlyError(sessions.error)); else this.sessions.set(sessions.data || []);
    } else {
      this.sessions.set([]);
    }
    if (!this.editingId()) this.schedule = { weekday: 2, start_time: '', end_time: '', effective_from: today };
  }

  editSchedule(item: any): void {
    const effectiveFrom = item.effective_from && item.effective_from > this.today() ? item.effective_from : this.today();
    this.editingId.set(item.id);
    this.schedule = { weekday: Number(item.weekday), start_time: item.start_time || '', end_time: item.end_time || '', effective_from: effectiveFrom };
    this.error.set('');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.schedule = this.blankSchedule();
    this.error.set('');
  }

  async saveSchedule(): Promise<void> {
    if (this.auth.role() !== 'ADMIN') return;
    const weekday = Number(this.schedule.weekday);
    const startTime = this.schedule.start_time || null;
    const endTime = this.schedule.end_time || null;
    const effectiveFrom = String(this.schedule.effective_from || '').trim();
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !effectiveFrom || (endTime && !startTime) || (startTime && endTime && endTime <= startTime)) {
      this.error.set('Thứ, ngày áp dụng và khung giờ phải hợp lệ; giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const result = await this.supabase.client.rpc('rpc_save_class_schedule', {
        p_class_id: this.id,
        p_schedule_id: this.editingId(),
        p_weekday: weekday,
        p_start_time: startTime,
        p_end_time: endTime,
        p_effective_from: effectiveFrom,
      });
      if (result.error) {
        this.error.set(this.friendlyError(result.error));
        return;
      }
      this.toast.success(this.editingId() ? 'Đã cập nhật lịch học.' : 'Đã thêm lịch học.');
      this.editingId.set(null);
      this.schedule = this.blankSchedule();
      await this.load();
    } catch (error) {
      this.error.set(this.friendlyError(error));
    } finally {
      this.saving.set(false);
    }
  }

  async generate(): Promise<void> {
    await this.period.ready;
    const currentPeriod = this.period.current();
    if (!currentPeriod) return;
    this.generating = true;
    try {
      await this.edge.invoke('generate-month-sessions', { class_id: this.id, period_id: currentPeriod.id });
      this.toast.success('Đã sinh buổi học.');
      await this.load();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Không thể sinh buổi.');
    } finally {
      this.generating = false;
    }
  }

  dayLabel(value: number): string { return this.days.find((day) => day.value === Number(value))?.label || String(value); }
  private blankSchedule(): ScheduleForm { return { weekday: 2, start_time: '', end_time: '', effective_from: this.today() }; }
  private today(): string { return new Date().toISOString().slice(0, 10); }
  private friendlyError(error: any): string {
    const message = String(error?.message || error || '');
    if (message.includes('CLASS_INACTIVE')) return 'Lớp đã ngừng hoạt động, không thể sửa lịch.';
    if (message.includes('CLASS_NOT_FOUND')) return 'Không tìm thấy lớp hoặc lớp không còn trong phạm vi quyền.';
    if (message.includes('SCHEDULE_NOT_FOUND')) return 'Lịch học không còn tồn tại hoặc đã được thay đổi.';
    if (message.includes('SCHEDULE_EFFECTIVE_DATE_PAST')) return 'Lịch mới phải có ngày áp dụng từ hôm nay trở đi.';
    return message || 'Không thể lưu lịch học.';
  }
}
