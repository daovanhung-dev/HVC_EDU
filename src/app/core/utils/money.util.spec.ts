import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney } from './money.util';

describe('money utilities', () => {
  it('formats integer VND without decimals', () => {
    expect(formatMoney(14485000)).toContain('14.485.000');
    expect(formatMoney(14485000)).toContain('₫');
  });
  it('parses formatted VND as an integer', () => {
    expect(parseMoney('14.485.000 đ')).toBe(14485000);
  });
});
