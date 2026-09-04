import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <section class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">⌁</div>
      <strong>{{ title }}</strong>
      <p class="muted">{{ description }}</p>
      @if (actionLabel) { <button class="secondary" type="button" (click)="action.emit()">{{ actionLabel }}</button> }
    </section>
  `,
})
export class EmptyStateComponent {
  @Input() title = 'Chưa có dữ liệu';
  @Input() description = 'Dữ liệu sẽ hiển thị tại đây khi có thông tin phù hợp.';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
