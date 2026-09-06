import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('minimal routes', () => {
  const children = routes.find((route) => route.path === '')?.children ?? [];

  it('contains only the operational application routes', () => {
    expect(children.map((route) => route.path)).toEqual([
      '', 'dashboard', 'classes', 'classes/:id', 'classes/:classId/sessions/:sessionId/attendance',
      'classes/:classId/sessions/:sessionId/evaluation', 'staff', 'staff/attendance', 'finance', 'account',
    ]);
  });

  it('protects staff and finance management for Admin', () => {
    expect(children.find((route) => route.path === 'staff')?.data).toMatchObject({ roles: ['ADMIN'] });
    expect(children.find((route) => route.path === 'finance')?.data).toMatchObject({ roles: ['ADMIN'] });
  });

  it('exposes Root account control separately from the Supabase-authenticated shell', () => {
    const rootRoute = routes.find((route) => route.path === 'root/admins');
    expect(rootRoute?.canActivate).toHaveLength(1);
    expect(rootRoute?.loadComponent).toBeTypeOf('function');
  });
});
