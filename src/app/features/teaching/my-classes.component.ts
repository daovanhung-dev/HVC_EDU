import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { roleLabel } from '../../core/utils/status.util';
import { MyClass, MyClassesService } from './my-classes.service';

@Component({
  selector: 'app-my-classes',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent],
  template: `
    <section class="page-header app-page-header">
      <div><p class="eyebrow">GIẢNG DẠY</p><h1>Lớp của tôi</h1><p class="page-description muted">Các lớp đang được phân công, cùng lịch học, học sinh và lịch sử học tập.</p></div>
      <a class="secondary" routerLink="/teaching-schedule">Lịch dạy</a>
    </section>
    @if (error()) { <section class="error-state"><div><strong>Không tải được lớp đang dạy</strong><p>{{ error() }}</p></div><button class="secondary" type="button" (click)="load()">Thử lại</button></section> }
    @if (loading()) { <app-loading-state label="Đang tải các lớp được phân công…" /> }
    @else if (!error()) {
      <section class="grid-3">
        @for (item of classes(); track item.id) {
          <a class="card link-card my-class-card" [routerLink]="['/my-classes', item.id]">
            <div class="my-class-card-top"><div><p class="eyebrow">{{ item.code }}</p><h2>{{ item.name }}</h2></div><span class="badge active">Khối {{ item.grade }}</span></div>
            <div class="my-class-meta"><span>{{ item.subject }}</span><span>{{ roleSummary(item) }}</span></div>
            <span class="my-class-arrow">Xem lớp →</span>
          </a>
        }
        @empty { <section class="card empty-state"><strong>Chưa có lớp được phân công</strong><p class="muted">Khi Admin phân công lớp, lớp sẽ xuất hiện tại đây.</p></section> }
      </section>
    }
  `,
})
export class MyClassesComponent implements OnInit {
  readonly classes = signal<MyClass[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor(private readonly myClasses: MyClassesService) {}

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.classes.set(await this.myClasses.listAssignedClasses());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Không thể tải lớp đang dạy.');
    } finally {
      this.loading.set(false);
    }
  }

  roleSummary(item: MyClass): string {
    return Array.from(new Set(item.assignments.map((assignment) => roleLabel(assignment.role)))).join(' · ') || 'Đang phân công';
  }
}
