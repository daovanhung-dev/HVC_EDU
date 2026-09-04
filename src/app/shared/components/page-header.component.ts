import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header class="page-header app-page-header">
      <div>
        @if (eyebrow) { <p class="eyebrow">{{ eyebrow }}</p> }
        <h1>{{ title }}</h1>
        @if (description) { <p class="muted page-description">{{ description }}</p> }
      </div>
      <div class="page-header-actions"><ng-content /></div>
    </header>
  `,
})
export class PageHeaderComponent {
  @Input() eyebrow = '';
  @Input() title = '';
  @Input() description = '';
}
