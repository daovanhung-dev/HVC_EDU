import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  template: `
    <section class="error-state" role="alert">
      <div><strong>Không thể tải dữ liệu</strong><p>{{ message }}</p></div>
      <button class="secondary" type="button" (click)="retry.emit()">Thử lại</button>
    </section>
  `,
})
export class ErrorStateComponent {
  @Input() message = 'Đã xảy ra lỗi không xác định.';
  @Output() retry = new EventEmitter<void>();
}
