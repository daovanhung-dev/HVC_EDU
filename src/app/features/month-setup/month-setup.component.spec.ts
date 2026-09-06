import { describe, expect, it, vi } from 'vitest';
import { MonthSetupComponent } from './month-setup.component';
import { MonthSetupPreview } from '../../core/services/workflow.service';

function createComponent(): MonthSetupComponent {
  return new MonthSetupComponent(
    { queryParamMap: { subscribe: vi.fn() } } as any,
    {} as any,
    { ready: Promise.resolve(), current: vi.fn(), load: vi.fn() } as any,
    { success: vi.fn() } as any,
  );
}

function previewWithRoster(): MonthSetupPreview {
  return {
    period: null,
    classes: [
      { id: 'class-09', code: 'L09', name: 'Lớp 09' },
      { id: 'class-06', code: 'L06', name: 'Lớp 06' },
      { id: 'class-07', code: 'L07', name: 'Lớp 07' },
    ],
    class_configs: [],
    schedules: [],
    assignments: [],
    staff: [],
    settings: [],
    policy: null,
    students: [
      {
        id: 'student-07-011',
        code: 'HS07-011',
        full_name: 'Bảo An',
        enrollments: [{ id: 'enrollment-07-011', class_id: 'class-07', status: 'ACTIVE' }],
      },
      {
        id: 'student-06-002',
        code: 'HS06-002',
        full_name: 'Bảo Dũng',
        enrollments: [{ id: 'enrollment-06-002', class_id: 'class-06', status: 'ACTIVE' }],
      },
      {
        id: 'student-07-002',
        code: 'HS07-002',
        full_name: 'An Nhiên',
        enrollments: [
          { id: 'enrollment-07-002', class_id: 'class-07', status: 'ACTIVE' },
          { id: 'enrollment-left', class_id: 'class-06', status: 'LEFT' },
        ],
      },
      {
        id: 'student-09-001',
        code: 'HS09-001',
        full_name: 'Anh Trọng',
        enrollments: [{ id: 'enrollment-09-001', class_id: 'class-09', status: 'ACTIVE' }],
      },
    ],
  } as MonthSetupPreview;
}

describe('MonthSetupComponent roster groups', () => {
  it('groups active enrollments by class and sorts classes and students by code', () => {
    const component = createComponent();
    component.preview = previewWithRoster();

    const groups = component.rosterGroups();

    expect(groups.map((group) => [group.classCode, group.students.length])).toEqual([
      ['L06', 1],
      ['L07', 2],
      ['L09', 1],
    ]);
    expect(groups[1].students.map((row) => row.student.code)).toEqual(['HS07-002', 'HS07-011']);
    expect(groups.flatMap((group) => group.students.map((row) => row.enrollment.id))).toEqual([
      'enrollment-06-002',
      'enrollment-07-002',
      'enrollment-07-011',
      'enrollment-09-001',
    ]);
  });

  it('returns no groups when the snapshot has no active enrollment', () => {
    const component = createComponent();
    component.preview = {
      ...previewWithRoster(),
      students: [{ id: 'student-left', code: 'HS06-003', full_name: 'Đã nghỉ', enrollments: [{ id: 'enrollment-left-only', class_id: 'class-06', status: 'LEFT' }] }],
    };

    expect(component.rosterGroups()).toEqual([]);
  });

  it('keeps roster actions and price overrides keyed by the original enrollment', () => {
    const component = createComponent();
    component.preview = previewWithRoster();
    component.draft = component.fromPreview(component.preview);

    component.setAction({ id: 'enrollment-07-002', class_id: 'class-07' }, 'LEAVE');
    component.setPrice({ id: 'enrollment-07-002', class_id: 'class-07' }, '75000');

    expect(component.draft.enrollment_actions.find((row) => row.source_enrollment_id === 'enrollment-07-002')).toMatchObject({
      source_enrollment_id: 'enrollment-07-002',
      action: 'LEAVE',
      unit_price_override: 75000,
    });
    expect(component.draft.enrollment_actions).toHaveLength(4);
  });
});
