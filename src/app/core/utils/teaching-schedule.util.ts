export type ScheduleDateWindow = {
  active?: boolean;
  effective_from: string;
  effective_to?: string | null;
};

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function isoWeekday(value: string): number {
  const date = utcDate(value);
  if (Number.isNaN(date.getTime())) return 0;
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

export function datesInRange(from: string, to: string): string[] {
  const start = utcDate(from);
  const end = utcDate(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const result: string[] = [];
  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    result.push(current.toISOString().slice(0, 10));
  }
  return result;
}

export function scheduleAppliesOn(schedule: ScheduleDateWindow, date: string): boolean {
  return schedule.active !== false
    && schedule.effective_from <= date
    && (!schedule.effective_to || schedule.effective_to >= date);
}

export function scheduleOccurrenceKey(classId: string, date: string, startTime: string | null): string {
  return `${classId}|${date}|${startTime ?? ''}`;
}
