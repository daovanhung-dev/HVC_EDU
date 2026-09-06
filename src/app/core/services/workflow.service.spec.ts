import { describe, expect, it, vi } from 'vitest';
import { WorkflowService } from './workflow.service';

class Query<T> {
  constructor(private readonly rows: T[]) {}

  select(): this { return this; }
  eq(): this { return this; }
  in(): this { return this; }
  gte(): this { return this; }
  lte(): this { return this; }
  order(): this { return this; }

  maybeSingle(): Promise<{ data: T | null; error: null }> {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }

  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected);
  }
}

function serviceWith(data: Record<string, unknown[]>): { service: WorkflowService; from: ReturnType<typeof vi.fn> } {
  const from = vi.fn((table: string) => new Query(data[table] ?? []));
  const client = { from };
  return { service: new WorkflowService({ client } as any, {} as any), from };
}

const schedule = {
  id: 'schedule-6-sunday',
  class_id: 'class-6',
  weekday: 7,
  start_time: '17:30:00',
  end_time: '19:30:00',
  effective_from: '2026-09-06',
  effective_to: null,
  active: true,
  class: { code: 'LT6', name: 'Lớp Toán 6' },
};

describe('WorkflowService.teachingSchedule', () => {
  it('shows weekly schedule when no accounting period or session exists', async () => {
    const { service, from } = serviceWith({ accounting_periods: [], class_schedules: [schedule], class_sessions: [], staff_work_attendance: [] });

    const rows = await service.teachingSchedule('2026-09-06', '2026-09-06');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      class_id: 'class-6',
      session_date: '2026-09-06',
      start_time: '17:30:00',
      end_time: '19:30:00',
      source: 'WEEKLY_SCHEDULE',
      session_id: null,
      schedule_id: 'schedule-6-sunday',
      period_id: null,
      class: { code: 'LT6', name: 'Lớp Toán 6' },
    });
    expect(from).not.toHaveBeenCalledWith('class_sessions');
  });

  it('keeps a generated session and does not duplicate it with weekly schedule', async () => {
    const session = {
      id: 'session-6-sunday',
      class_id: 'class-6',
      period_id: 'period-2026-09',
      session_date: '2026-09-06',
      start_time: '17:30:00',
      end_time: '19:30:00',
      status: 'SCHEDULED',
      class: { code: 'LT6', name: 'Lớp Toán 6' },
    };
    const { service } = serviceWith({
      accounting_periods: [{ id: 'period-2026-09', start_date: '2026-09-01', end_date: '2026-09-30' }],
      class_schedules: [schedule],
      class_sessions: [session],
      staff_work_attendance: [],
    });

    const rows = await service.teachingSchedule('2026-09-06', '2026-09-06');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: 'SESSION', id: 'session-6-sunday', session_id: 'session-6-sunday', schedule_id: null, period_id: 'period-2026-09' });
  });
});
