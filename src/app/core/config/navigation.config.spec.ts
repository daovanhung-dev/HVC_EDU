import { describe, expect, it } from 'vitest';
import { NAVIGATION_ITEMS, SECONDARY_NAVIGATION, canAccessNavigationItem } from './navigation.config';

describe('navigation configuration', () => {
  it('exposes the simplified role-based workflow hubs', () => {
    expect(NAVIGATION_ITEMS.map((item) => item.id)).toEqual([
      'home', 'months', 'my-classes', 'classes', 'students', 'teaching-schedule', 'staff', 'finance', 'work', 'notifications',
    ]);
    expect(NAVIGATION_ITEMS.find((item) => item.id === 'finance')?.path).toBe('/finance');
    expect(SECONDARY_NAVIGATION.map((item) => item.id)).toEqual(['settings', 'account']);
  });

  it('keeps role visibility separate from route authorization', () => {
    const schedule = NAVIGATION_ITEMS.find((item) => item.id === 'teaching-schedule')!;
    const myClasses = NAVIGATION_ITEMS.find((item) => item.id === 'my-classes')!;
    const work = NAVIGATION_ITEMS.find((item) => item.id === 'work')!;
    const finance = NAVIGATION_ITEMS.find((item) => item.id === 'finance')!;
    expect(canAccessNavigationItem(schedule, 'ASSISTANT')).toBe(true);
    expect(canAccessNavigationItem(myClasses, 'TEACHER')).toBe(true);
    expect(canAccessNavigationItem(myClasses, 'ASSISTANT')).toBe(true);
    expect(canAccessNavigationItem(myClasses, 'ADMIN')).toBe(false);
    expect(canAccessNavigationItem(myClasses, 'ACCOUNTANT')).toBe(false);
    expect(canAccessNavigationItem(work, 'TEACHER')).toBe(true);
    expect(canAccessNavigationItem(finance, 'TEACHER')).toBe(false);
    expect(canAccessNavigationItem(finance, 'ACCOUNTANT')).toBe(true);
  });
});
