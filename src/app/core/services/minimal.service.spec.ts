import { describe, expect, it, vi } from 'vitest';
import { MinimalService } from './minimal.service';

function serviceWithSpy() {
  const edge = { invoke: vi.fn().mockResolvedValue({}) };
  return { service: new MinimalService({} as never, edge as never), edge };
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
