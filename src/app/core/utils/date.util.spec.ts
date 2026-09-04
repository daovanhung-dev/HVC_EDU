import { describe, expect, it } from 'vitest';
import { formatDate, monthBounds } from './date.util';

describe('date utilities', () => {
  it('returns the first and last day of a month', () => {
    expect(monthBounds(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
  it('formats dates for Vietnamese users', () => {
    expect(formatDate('2026-02-03')).toContain('03/02/2026');
    expect(formatDate(null)).toBe('—');
  });
});
