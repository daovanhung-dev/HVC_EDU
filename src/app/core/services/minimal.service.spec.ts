import { describe, expect, it, vi } from 'vitest';
import { MinimalService } from './minimal.service';

function serviceWithSpy() {
  const edge = { invoke: vi.fn().mockResolvedValue({}) };
  const auth = { refreshAccessToken: vi.fn(), expireSession: vi.fn() };
  return { service: new MinimalService({} as never, edge as never, auth as never), edge, auth };
}

function queryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function readService(results: Array<{ data: unknown; error: unknown }>) {
  const builders = results.map(queryBuilder);
  const client = { from: vi.fn(() => builders.shift()) };
  const auth = {
    refreshAccessToken: vi.fn().mockResolvedValue({ access_token: 'refreshed' }),
    expireSession: vi.fn().mockResolvedValue(undefined),
  };
  const service = new MinimalService({ client } as never, {} as never, auth as never);
  return { service, auth, client };
}

describe('MinimalService mutation payloads', () => {
  it('uses rows for attendance and evaluation bulk payloads', async () => {
    const { service, edge } = serviceWithSpy();
    const student = { id: 'student-1', code: 'HS001', full_name: 'An' };

    await service.saveAttendance('session-1', [{ enrollment_id: 'enrollment-1', student, status: 'PRESENT', note: '' }]);
    expect(edge.invoke).toHaveBeenLastCalledWith('attendance-bulk-upsert', {
      session_id: 'session-1',
      rows: [{ enrollment_id: 'enrollment-1', status: 'PRESENT', note: null }],
    });

    await service.saveEvaluations('session-1', [{ enrollment_id: 'enrollment-1', student, comment: 'Tiến bộ' }]);
    expect(edge.invoke).toHaveBeenLastCalledWith('evaluation-bulk-upsert', {
      session_id: 'session-1',
      rows: [{ enrollment_id: 'enrollment-1', comment: 'Tiến bộ' }],
    });
  });

  it('passes idempotency key when generating sessions', async () => {
    const { service, edge } = serviceWithSpy();

    await service.generateSessions('2026-09-01', '2026-09-14');

    expect(edge.invoke).toHaveBeenCalledWith(
      'generate-class-sessions',
      { from_date: '2026-09-01', to_date: '2026-09-14' },
      'sessions:2026-09-01:2026-09-14',
    );
  });

  it('routes master data and finance mutations to the expected functions', async () => {
    const { service, edge } = serviceWithSpy();

    await service.upsertStaff({ staff_id: null, code: 'GV001' });
    await service.upsertClass({ class_id: null, code: 'L06' });
    await service.upsertStudent({ student_id: null, code: 'HS001' });
    await service.upsertEnrollment({ enrollment_id: null, student_id: 'student-1', class_id: 'class-1' });
    await service.upsertAssignment({ assignment_id: null, class_id: 'class-1', staff_id: 'staff-1' });
    await service.upsertSchedule({ schedule_id: null, class_id: 'class-1', weekday: 2 });
    await service.deactivate('students', 'student-1');
    await service.recordTransaction({ transaction_date: '2026-09-06', type: 'INCOME', category: 'Khác', description: 'Thu khác', amount: 100000 });

    expect(edge.invoke.mock.calls.map(([name]) => name)).toEqual([
      'admin-master-data', 'admin-master-data', 'admin-master-data', 'admin-master-data',
      'admin-master-data', 'admin-master-data', 'admin-master-data', 'record-financial-transaction',
    ]);
    expect(edge.invoke.mock.calls[0][1]).toMatchObject({ operation: 'UPSERT_STAFF' });
    expect(edge.invoke.mock.calls[6][1]).toEqual({ operation: 'DEACTIVATE', entity: 'students', id: 'student-1' });
    expect(edge.invoke.mock.calls[7][1]).toMatchObject({ type: 'INCOME', amount: 100000 });
  });
});

describe('MinimalService authenticated reads', () => {
  it('refreshes the access token and retries class loading once after a JWT error', async () => {
    const rows = [{ id: 'class-1', code: 'L06', name: 'Lớp 6', grade: 6, subject: 'Toán', note: null, status: 'ACTIVE' }];
    const { service, auth, client } = readService([
      { data: null, error: { status: 401, code: 'PGRST301', message: 'JWT expired' } },
      { data: rows, error: null },
    ]);

    await expect(service.listClasses()).resolves.toEqual(rows);

    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(2);
    const firstQuery = client.from.mock.results[0].value;
    expect(firstQuery.order).toHaveBeenCalledWith('code');
    expect(firstQuery.eq).toHaveBeenCalledWith('status', 'ACTIVE');
  });

  it('ends the session when the retried class request is still unauthorized', async () => {
    const authError = { status: 401, code: 'PGRST301', message: 'JWT expired' };
    const { service, auth } = readService([
      { data: null, error: authError },
      { data: null, error: authError },
    ]);

    await expect(service.listClasses()).rejects.toMatchObject({ code: 'AUTH_SESSION_EXPIRED' });

    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
  });

  it('does not refresh for a forbidden read', async () => {
    const { service, auth } = readService([
      { data: null, error: { status: 403, code: '42501', message: 'permission denied' } },
    ]);

    await expect(service.listClasses()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.expireSession).not.toHaveBeenCalled();
  });

  it('preserves non-auth data errors', async () => {
    const error = { status: 500, code: 'PGRST000', message: 'database unavailable' };
    const { service } = readService([{ data: null, error }]);

    await expect(service.listClasses()).rejects.toBe(error);
  });
});
