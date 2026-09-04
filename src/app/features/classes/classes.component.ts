import { Component, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';

type CenterClass = { id: string; code: string; name: string; grade: number; subject: string; standard_unit_fee: number; collection_method: string; status: string };

@Component({
  selector: 'app-classes',
  standalone: true,
  template: `
    <section class="page-header"><div><p class="eyebrow">ĐÀO TẠO</p><h1>Lớp học</h1></div><button class="primary">+ Tạo lớp</button></section>
    <div class="card table-wrap">
      <table><thead><tr><th>Mã</th><th>Tên lớp</th><th>Khối</th><th>Môn</th><th>Học phí/buổi</th><th>Cách thu</th><th>Trạng thái</th></tr></thead>
      <tbody>
        @for (item of items(); track item.id) {
          <tr><td>{{ item.code }}</td><td>{{ item.name }}</td><td>{{ item.grade }}</td><td>{{ item.subject }}</td><td>{{ money(item.standard_unit_fee) }}</td><td>{{ item.collection_method }}</td><td>{{ item.status }}</td></tr>
        } @empty { <tr><td colspan="7" class="empty">Chưa có lớp. Chạy seed/migration để bắt đầu.</td></tr> }
      </tbody></table>
    </div>
  `,
})
export class ClassesComponent implements OnInit {
  readonly items = signal<CenterClass[]>([]);
  constructor(private readonly supabase: SupabaseService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> {
    const { data } = await this.supabase.client.from('classes').select('id,code,name,grade,subject,standard_unit_fee,collection_method,status').order('grade');
    this.items.set((data ?? []) as CenterClass[]);
  }
  money(value: number): string { return new Intl.NumberFormat('vi-VN').format(value) + ' đ'; }
}
