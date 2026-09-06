import { describe, expect, it } from 'vitest';
import { NAVIGATION_ITEMS, SECONDARY_NAVIGATION, canAccessNavigationItem } from './navigation.config';

describe('minimal navigation', () => {
  it('contains only the operational modules', () => {
    expect(NAVIGATION_ITEMS.map((item) => item.id)).toEqual(['dashboard', 'classes', 'staff', 'staff-attendance', 'finance']);
    expect(SECONDARY_NAVIGATION.map((item) => item.id)).toEqual(['account']);
  });

  it('limits finance and staff management to Admin', () => {
    const finance = NAVIGATION_ITEMS.find((item) => item.id === 'finance')!;
    const staff = NAVIGATION_ITEMS.find((item) => item.id === 'staff')!;
    const classes = NAVIGATION_ITEMS.find((item) => item.id === 'classes')!;
    expect(canAccessNavigationItem(finance, 'STAFF')).toBe(false);
    expect(canAccessNavigationItem(staff, 'STAFF')).toBe(false);
    expect(canAccessNavigationItem(classes, 'STAFF')).toBe(true);
    expect(canAccessNavigationItem(finance, 'ADMIN')).toBe(true);
  });
});
