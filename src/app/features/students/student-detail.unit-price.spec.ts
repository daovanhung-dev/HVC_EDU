import { describe, expect, it, vi } from 'vitest';
import { StudentDetailComponent } from './student-detail.component';

function createComponent(role: string) {
  const rpc = vi.fn().mockResolvedValue({ data: { enrollment_id: 'enrollment-1' }, error: null });
  const auth = { role: vi.fn(() => role) };
  const confirm = { ask: vi.fn(() => true) };
  const toast = { success: vi.fn() };
  const component = new StudentDetailComponent(
    {} as any,
    { client: { rpc } } as any,
    auth as any,
    {} as any,
    confirm as any,
    toast as any,
  );
  component.load = vi.fn().mockResolvedValue(undefined);
  return { component, rpc, confirm, toast };
}

describe('StudentDetailComponent enrollment unit price', () => {
  it('updates the selected enrollment and reloads the student detail', async () => {
    const { component, rpc, toast } = createComponent('ADMIN');

    await component.saveEnrollmentUnitPrice({
      id: 'enrollment-1',
      edit_unit_price_override: 90000,
      class: { code: 'LT6' },
    });

    expect(rpc).toHaveBeenCalledWith('rpc_update_enrollment_unit_price', {
      p_enrollment_id: 'enrollment-1',
      p_unit_price_override: 90000,
    });
    expect(component.load).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật học phí riêng.');
  });

  it('keeps the student history read-only for teaching roles', async () => {
    const { component, rpc, confirm } = createComponent('TEACHER');

    await component.saveEnrollmentUnitPrice({ id: 'enrollment-1', edit_unit_price_override: 90000 });

    expect(rpc).not.toHaveBeenCalled();
    expect(confirm.ask).not.toHaveBeenCalled();
  });
});
