import { describe, expect, it } from 'vitest';
import { datesInRange, isoWeekday, scheduleAppliesOn, scheduleOccurrenceKey } from './teaching-schedule.util';

describe('teaching schedule date helpers', () => {
  it('maps Sunday to ISO weekday 7', () => {
    expect(isoWeekday('2026-09-06')).toBe(7);
  });

  it('enumerates a date range without timezone drift', () => {
    expect(datesInRange('2026-09-06', '2026-09-08')).toEqual(['2026-09-06', '2026-09-07', '2026-09-08']);
  });

  it('honors active effective date windows', () => {
    const schedule = { active: true, effective_from: '2026-09-06', effective_to: '2026-09-30' };
    expect(scheduleAppliesOn(schedule, '2026-09-05')).toBe(false);
    expect(scheduleAppliesOn(schedule, '2026-09-06')).toBe(true);
    expect(scheduleAppliesOn(schedule, '2026-10-01')).toBe(false);
    expect(scheduleAppliesOn({ ...schedule, active: false }, '2026-09-06')).toBe(false);
  });

  it('uses a stable class/date/time occurrence key', () => {
    expect(scheduleOccurrenceKey('class-6', '2026-09-06', '17:30:00')).toBe('class-6|2026-09-06|17:30:00');
    expect(scheduleOccurrenceKey('class-6', '2026-09-06', null)).toBe('class-6|2026-09-06|');
  });
});
