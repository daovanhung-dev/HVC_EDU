import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  template: `
    <section class="loading-state" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>{{ label }}</span>
    </section>
  `,
})
export class LoadingStateComponent {
  @Input() label = 'Đang tải dữ liệu…';
}
