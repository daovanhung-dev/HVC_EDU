import { describe, expect, it } from 'vitest';
import { monthBounds } from './date.util';

describe('date utilities', () => {
  it('returns the first and last day of a month', () => {
    expect(monthBounds(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});
