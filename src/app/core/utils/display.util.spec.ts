import { describe, expect, it } from 'vitest';
import { formatPercent } from './display.util';

describe('display utilities', () => {
  it('formats fractional rates as readable percentages', () => {
    expect(formatPercent(0.256, 2)).toBe('25.60%');
    expect(formatPercent(null)).toBe('0.0%');
  });
});
