import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { AuditComponent } from '../audit/audit.component';
import { MigrationComponent } from '../migration/migration.component';

type SettingsTab = 'settings' | 'audit' | 'migration';

@Component({
  selector: 'app-settings-hub',
  standalone: true,
  imports: [RouterLink, SettingsComponent, AuditComponent, MigrationComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">HỆ THỐNG</p><h1>Cài đặt</h1><p class="page-description muted">Chính sách, tài khoản, import và audit nằm trong một khu vực quản trị.</p></div></section>
    <nav class="hub-tabs"><a [class.active]="tab() === 'settings'" [routerLink]="['/settings']" [queryParams]="{ tab: 'settings' }">Thiết lập</a><a [class.active]="tab() === 'audit'" [routerLink]="['/settings']" [queryParams]="{ tab: 'audit' }">Audit</a><a [class.active]="tab() === 'migration'" [routerLink]="['/settings']" [queryParams]="{ tab: 'migration' }">Import</a></nav>
    @switch (tab()) { @case ('audit') { <app-audit /> } @case ('migration') { <app-migration /> } @default { <app-settings /> } }
  `,
})
export class SettingsHubComponent implements OnInit {
  readonly tab = signal<SettingsTab>('settings');
  constructor(private readonly route: ActivatedRoute) {}
  ngOnInit(): void { this.route.queryParamMap.subscribe((params) => { const value = params.get('tab'); this.tab.set(value === 'audit' || value === 'migration' ? value : 'settings'); }); }
}
