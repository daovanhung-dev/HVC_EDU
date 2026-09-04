import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';

describe('ApiError', () => {
  it('preserves server error code and message', () => {
    const error = new ApiError({ code: 'PERIOD_CLOSED', message: 'Kỳ đã đóng', details: { id: '1' } });
    expect(error.code).toBe('PERIOD_CLOSED');
    expect(error.message).toBe('Kỳ đã đóng');
    expect(error.details).toEqual({ id: '1' });
  });
});
