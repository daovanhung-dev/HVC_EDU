import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name) {
        @case ('dashboard') { <path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-3H4v3Z" /> }
        @case ('school') { <path d="m3 10 9-5 9 5-9 5-9-5Z" /><path d="M7 12v5c2.7 2 7.3 2 10 0v-5M21 10v6" /> }
        @case ('student') { <circle cx="12" cy="8" r="3" /><path d="M5 20c.7-3.2 3-5 7-5s6.3 1.8 7 5" /> }
        @case ('attendance') { <path d="M5 4h14v16H5z" /><path d="m8 12 2.2 2.2L16 8.5" /><path d="M8 7h2M8 17h5" /> }
        @case ('finance') { <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /> }
        @case ('people') { <circle cx="9" cy="8" r="3" /><path d="M3 20c.5-3.3 2.5-5 6-5s5.5 1.7 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.7M18 15c1.8.5 2.8 2.1 3 5" /> }
        @case ('bell') { <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /> }
        @case ('assignment') { <path d="M5 5h14v15H5z" /><path d="M9 5V3h6v2M8 10h8M8 14h6" /> }
        @case ('chart') { <path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-6" /> }
        @case ('menu') { <path d="M4 7h16M4 12h16M4 17h16" /> }
        @case ('close') { <path d="m6 6 12 12M18 6 6 18" /> }
        @case ('lock') { <rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /> }
        @case ('arrow-right') { <path d="M5 12h14M13 6l6 6-6 6" /> }
        @default { <circle cx="12" cy="12" r="8" /> }
      }
    </svg>
  `,
})
export class AppIconComponent {
  @Input() name = 'circle';
}
