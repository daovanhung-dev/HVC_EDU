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
        @case ('tuition') { <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /> }
        @case ('payment') { <path d="M3 7h18v12H3z" /><path d="M3 10h18M7 15h3" /><path d="M7 4v3M17 4v3" /> }
        @case ('debt') { <circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /> }
        @case ('transactions') { <path d="M4 7h13l-2-2M20 17H7l2 2" /><path d="M17 5v4M7 15v4" /> }
        @case ('reward') { <path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3Z" /> }
        @case ('payroll') { <path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /> }
        @case ('profit') { <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /> }
        @case ('people') { <circle cx="9" cy="8" r="3" /><path d="M3 20c.5-3.3 2.5-5 6-5s5.5 1.7 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.7M18 15c1.8.5 2.8 2.1 3 5" /> }
        @case ('bell') { <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /> }
        @case ('assignment') { <path d="M5 5h14v15H5z" /><path d="M9 5V3h6v2M8 10h8M8 14h6" /> }
        @case ('chart') { <path d="M4 19V5M4 19h16" /><path d="m7 15 3-4 3 2 5-6" /> }
        @case ('report') { <path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h4M8 12h8M8 16h6" /> }
        @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 17h.01M12 17h.01" /> }
        @case ('settings') { <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="M4.9 4.9 7 7m10-2.1L15 7M4 12H2m20 0h-2M4.9 19.1 7 17m10 2.1L15 17M12 4V2m0 20v-2" /> }
        @case ('audit') { <path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h4" /> }
        @case ('import') { <path d="M12 3v11M8 10l4 4 4-4M5 19h14" /> }
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
