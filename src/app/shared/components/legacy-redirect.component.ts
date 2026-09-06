import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-legacy-redirect',
  standalone: true,
  template: `<section class="card loading-state"><span class="loading-spinner"></span><span>Đang mở không gian làm việc mới…</span></section>`,
})
export class LegacyRedirectComponent implements OnInit {
  constructor(private readonly route: ActivatedRoute, private readonly router: Router, private readonly auth: AuthService) {}
  ngOnInit(): void {
    const target = this.route.snapshot.data['target'] as string;
    const suffix = this.route.snapshot.data['suffix'] as string | undefined;
    const id = this.route.snapshot.paramMap.get('sessionId');
    const classId = this.route.snapshot.paramMap.get('classId');
    const queryParams = { ...this.route.snapshot.queryParams } as Record<string, string>;
    if (target === 'payroll') { if (['TEACHER', 'ASSISTANT'].includes(this.auth.role() || '')) { void this.router.navigate(['/work']); return; } queryParams['tab'] = queryParams['tab'] || 'payroll'; }
    const defaultTab = this.route.snapshot.data['defaultTab'] as string | undefined;
    if (defaultTab && !queryParams['tab']) queryParams['tab'] = defaultTab;
    if (classId) queryParams['classId'] = classId;
    const commands = suffix && id ? [target, id, suffix] : id ? [target, id] : [target];
    void this.router.navigate(commands, { queryParams });
  }
}
