import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('workflow routes', () => {
  const children = routes.find((route) => route.path === '')?.children ?? [];

  it('keeps canonical hubs for the rebuilt workflow', () => {
    expect(children.map((route) => route.path)).toEqual(expect.arrayContaining([
      'dashboard', 'periods', 'classes', 'students', 'teaching-schedule', 'work', 'staff', 'finance', 'notifications', 'account', 'settings',
      'my-classes', 'my-classes/:classId',
    ]));
  });

  it('protects My Classes for teaching roles', () => {
    expect(children.find((route) => route.path === 'my-classes')?.data).toMatchObject({ roles: ['ADMIN', 'TEACHER', 'ASSISTANT'] });
    expect(children.find((route) => route.path === 'my-classes/:classId')?.data).toMatchObject({ roles: ['ADMIN', 'TEACHER', 'ASSISTANT'] });
  });

  it('maps legacy bookmarks to the new hubs', () => {
    expect(children.find((route) => route.path === 'finance/tuition')?.data).toMatchObject({ target: 'finance', defaultTab: 'tuition' });
    expect(children.find((route) => route.path === 'payroll')?.data).toMatchObject({ target: 'payroll' });
    expect(children.find((route) => route.path === 'attendance/:sessionId')?.data).toMatchObject({ target: 'teaching-schedule' });
    expect(children.find((route) => route.path === 'audit')?.data).toMatchObject({ target: 'settings', defaultTab: 'audit' });
  });
});
