import { describe, expect, it, vi } from 'vitest';
import { ClassDetailComponent } from './class-detail.component';

function createComponent(role: string, rpcResult = { data: { enrollment_id: 'enrollment-1' }, error: null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const auth = { role: vi.fn(() => role) };
  const confirm = { ask: vi.fn(() => true) };
  const toast = { success: vi.fn() };
  const component = new ClassDetailComponent(
    {} as any,
    {} as any,
    { client: { rpc } } as any,
    auth as any,
    {} as any,
    confirm as any,
    toast as any,
  );
  component.load = vi.fn().mockResolvedValue(undefined);
  return { component, rpc, auth, confirm, toast };
}

describe('ClassDetailComponent enrollment unit price', () => {
  it('updates an integer VND override', async () => {
    const { component, rpc, toast } = createComponent('ADMIN');

    await component.saveEnrollmentUnitPrice({
      id: 'enrollment-1',
      edit_unit_price_override: 75000,
      student: { full_name: 'Nguyễn An' },
    });

    expect(rpc).toHaveBeenCalledWith('rpc_update_enrollment_unit_price', {
      p_enrollment_id: 'enrollment-1',
      p_unit_price_override: 75000,
    });
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật học phí riêng.');
  });

  it('sends null when the Admin clears the override', async () => {
    const { component, rpc } = createComponent('ADMIN');

    await component.saveEnrollmentUnitPrice({ id: 'enrollment-1', edit_unit_price_override: '' });

    expect(rpc).toHaveBeenCalledWith('rpc_update_enrollment_unit_price', {
      p_enrollment_id: 'enrollment-1',
      p_unit_price_override: null,
    });
  });

  it('rejects invalid values before asking for confirmation or calling the RPC', async () => {
    const { component, rpc, confirm } = createComponent('ADMIN');

    await component.saveEnrollmentUnitPrice({ id: 'enrollment-1', edit_unit_price_override: 75000.5 });

    expect(rpc).not.toHaveBeenCalled();
    expect(confirm.ask).not.toHaveBeenCalled();
    expect(component.error()).toContain('số nguyên VND');
  });

  it('does not allow non-admin roles to invoke the mutation', async () => {
    const { component, rpc, confirm } = createComponent('ACCOUNTANT');

    await component.saveEnrollmentUnitPrice({ id: 'enrollment-1', edit_unit_price_override: 75000 });

    expect(rpc).not.toHaveBeenCalled();
    expect(confirm.ask).not.toHaveBeenCalled();
  });
});
