import { Component, OnInit, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';

type Student = { id: string; code: string; full_name: string; parent_name: string | null; parent_phone: string | null; status: string };

@Component({
  selector: 'app-students',
  standalone: true,
  template: `
    <section class="page-header"><div><p class="eyebrow">ĐÀO TẠO</p><h1>Học sinh</h1></div><button class="primary">+ Thêm học sinh</button></section>
    <div class="card table-wrap"><table><thead><tr><th>Mã HS</th><th>Họ tên</th><th>Phụ huynh</th><th>SĐT PH</th><th>Trạng thái</th></tr></thead><tbody>
    @for (item of items(); track item.id) { <tr><td>{{ item.code }}</td><td>{{ item.full_name }}</td><td>{{ item.parent_name || '-' }}</td><td>{{ item.parent_phone || '-' }}</td><td>{{ item.status }}</td></tr> }
    @empty { <tr><td colspan="5" class="empty">Chưa có dữ liệu học sinh.</td></tr> }
    </tbody></table></div>
  `,
})
export class StudentsComponent implements OnInit {
  readonly items = signal<Student[]>([]);
  constructor(private readonly supabase: SupabaseService) {}
  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> {
    const { data } = await this.supabase.client.from('students').select('id,code,full_name,parent_name,parent_phone,status').order('full_name');
    this.items.set((data ?? []) as Student[]);
  }
}
