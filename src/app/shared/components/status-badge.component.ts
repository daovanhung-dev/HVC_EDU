import { Component, Input } from '@angular/core';
import { statusLabel, statusTone } from '../../core/utils/status.util';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="badge status-badge" [class.tone-positive]="tone() === 'positive'" [class.tone-warning]="tone() === 'warning'" [class.tone-danger]="tone() === 'danger'" [class.tone-neutral]="tone() === 'neutral'">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  @Input() value: string | null | undefined = null;

  label(): string { return statusLabel(this.value); }
  tone(): string { return statusTone(this.value); }
}
