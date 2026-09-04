import { Component } from '@angular/core';
import { PeriodContextService } from '../../core/services/period-context.service';
import { statusLabel } from '../../core/utils/status.util';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-period-selector',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <label class="period-selector">
      <span class="period-selector-label">Kỳ đang làm việc</span>
      <select [value]="period.current()?.id || ''" (change)="select($any($event.target).value)" aria-label="Chọn kỳ kế toán">
        @for (item of period.periods(); track item.id) {
          <option [value]="item.id">{{ item.month }}/{{ item.year }} · {{ statusLabel(item.status) }}</option>
        }
      </select>
      @if (period.current()) { <app-status-badge [value]="period.current()?.status" /> }
    </label>
  `,
})
export class PeriodSelectorComponent {
  constructor(readonly period: PeriodContextService) {}

  statusLabel(value: string): string { return statusLabel(value); }

  select(id: string): void {
    const selected = this.period.periods().find((item) => item.id === id);
    if (selected) this.period.select(selected);
  }
}
