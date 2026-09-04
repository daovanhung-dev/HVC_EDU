import { describe, expect, it } from 'vitest';
import { roleLabel, statusLabel, statusTone } from './status.util';

describe('status utilities', () => {
  it('translates business status codes into human-readable Vietnamese labels', () => {
    expect(statusLabel('ACTIVE')).toBe('Đang hoạt động');
    expect(statusLabel('PARTIAL')).toBe('Thanh toán một phần');
    expect(statusLabel('PRESENT')).toBe('Có mặt');
  });

  it('uses safe fallback text for unknown or missing values', () => {
    expect(statusLabel('CUSTOM_STATUS')).toBe('CUSTOM_STATUS');
    expect(statusLabel(null)).toBe('Chưa xác định');
    expect(roleLabel('TEACHER')).toBe('Giáo viên');
  });

  it('maps statuses to accessible visual tones', () => {
    expect(statusTone('APPROVED')).toBe('positive');
    expect(statusTone('CLOSING')).toBe('warning');
    expect(statusTone('CANCELLED')).toBe('danger');
    expect(statusTone('CUSTOM_STATUS')).toBe('neutral');
  });
});
