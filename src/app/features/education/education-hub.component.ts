import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClassesComponent } from '../classes/classes.component';
import { StudentsComponent } from '../students/students.component';

@Component({
  selector: 'app-education-hub',
  standalone: true,
  imports: [RouterLink, ClassesComponent, StudentsComponent],
  template: `
    <section class="page-header app-page-header"><div><p class="eyebrow">VẬN HÀNH LỚP</p><h1>{{ tab() === 'students' ? 'Học sinh' : 'Lớp học' }}</h1><p class="page-description muted">Quản lý lớp, học sinh, lịch tuần và các buổi học.</p></div></section>
    <nav class="hub-tabs" aria-label="Dữ liệu lớp học"><a [class.active]="tab() === 'classes'" routerLink="/classes" [queryParams]="{ tab: 'classes' }">Lớp học</a><a [class.active]="tab() === 'students'" routerLink="/classes" [queryParams]="{ tab: 'students' }">Học sinh</a></nav>
    @if (tab() === 'students') { <app-students /> } @else { <app-classes /> }
  `,
})
export class EducationHubComponent implements OnInit {
  readonly tab = signal<'classes' | 'students'>('classes');
  constructor(private readonly route: ActivatedRoute) {}
  ngOnInit(): void { this.route.queryParamMap.subscribe((params) => this.tab.set(params.get('tab') === 'students' ? 'students' : 'classes')); }
}
