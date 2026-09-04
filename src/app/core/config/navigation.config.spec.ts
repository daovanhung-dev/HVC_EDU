import { describe, expect, it } from 'vitest';
import { NAVIGATION_SECTIONS, canAccessNavigationItem } from './navigation.config';

describe('navigation configuration', () => {
  it('exposes the complete function catalog grouped by business area', () => {
    const items = NAVIGATION_SECTIONS.flatMap((section) => section.items);
    expect(NAVIGATION_SECTIONS.map((section) => section.id)).toEqual(['overview', 'education', 'finance', 'people', 'reports', 'system']);
    expect(items.map((item) => item.path)).toContain('/finance/rewards');
    expect(items.map((item) => item.path)).toContain('/finance/fund-profit');
    expect(items.length).toBeGreaterThanOrEqual(15);
  });

  it('keeps navigation visibility separate from authorization', () => {
    const settings = NAVIGATION_SECTIONS.flatMap((section) => section.items).find((item) => item.path === '/settings');
    const attendance = NAVIGATION_SECTIONS.flatMap((section) => section.items).find((item) => item.path === '/attendance');
    expect(settings && canAccessNavigationItem(settings, 'ADMIN')).toBe(true);
    expect(settings && canAccessNavigationItem(settings, 'TEACHER')).toBe(false);
    expect(attendance && canAccessNavigationItem(attendance, 'ASSISTANT')).toBe(true);
    expect(attendance && canAccessNavigationItem(attendance, 'ACCOUNTANT')).toBe(false);
  });
});
