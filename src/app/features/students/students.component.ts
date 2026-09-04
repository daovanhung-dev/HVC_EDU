import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';

type StudentRow = {
  id: string;
  code: string;
  full_name: string;
  parent_name: string | null;
  parent_phone: string | null;
  status: string;
};

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [FormsModule, RouterLink, StatusBadgeComponent, LoadingStateComponent],
  template: `
    <section class="page-header">
      <div><p class="eyebrow">ĐÀO TẠO</p><h1>Học sinh</h1><p class="muted">Hồ sơ, phụ huynh và lịch sử xếp lớp.</p></div>
      @if (auth.role() === 'ADMIN') { <a class="primary" routerLink="/students/new">+ Thêm học sinh</a> }
    </section>
    @if (error()) { <div class="alert">{{ error() }}</div> }
    <div class="toolbar">
      <label>Tìm kiếm<input [(ngModel)]="search" placeholder="Mã, tên hoặc phụ huynh" /></label>
      <label>Trạng thái<select [(ngModel)]="status"><option value="">Tất cả</option><option value="ACTIVE">Đang học</option><option value="INACTIVE">Tạm nghỉ</option><option value="GRADUATED">Đã hoàn thành</option></select></label>
      <button class="secondary" type="button" (click)="load()">Làm mới</button>
    </div>
    @if (loading()) { <app-loading-state label="Đang tải danh sách học sinh…" /> } @else { <div class="card table-wrap"><table>
      <thead><tr><th>Mã</th><th>Họ tên</th><th>Phụ huynh</th><th>SĐT phụ huynh</th><th>Trạng thái</th></tr></thead>
      <tbody>
        @for (item of filtered(); track item.id) {
          <tr><td><a class="button-link" [routerLink]="['/students', item.id]">{{ item.code }}</a></td><td>{{ item.full_name }}</td><td>{{ item.parent_name || '—' }}</td><td>{{ item.parent_phone || '—' }}</td><td><app-status-badge [value]="item.status" /></td></tr>
        } @empty { <tr><td colspan="5" class="empty">Chưa có học sinh trong phạm vi quyền hiện tại.</td></tr>}
      </tbody>
    </table></div> }
  `,
})
export class StudentsComponent implements OnInit {
  readonly items = signal<StudentRow[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  search = '';
  status = '';

  constructor(private readonly supabase: SupabaseService, readonly auth: AuthService) {}

  ngOnInit() { void this.load(); }

  async load() {
    this.error.set('');
    this.loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('students')
        .select('id,code,full_name,parent_name,parent_phone,status')
        .order('full_name');
      if (error) this.error.set(error.message);
      else this.items.set((data ?? []) as StudentRow[]);
    } finally {
      this.loading.set(false);
    }
  }

  filtered() {
    const needle = this.search.trim().toLowerCase();
    return this.items().filter((item) => {
      const haystack = `${item.code} ${item.full_name} ${item.parent_name ?? ''} ${item.parent_phone ?? ''}`.toLowerCase();
      return (!needle || haystack.includes(needle)) && (!this.status || item.status === this.status);
    });
  }
}
