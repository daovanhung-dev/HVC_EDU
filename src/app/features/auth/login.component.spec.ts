import { describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';

function createComponent() {
  const auth = { signIn: vi.fn().mockResolvedValue(undefined), signOut: vi.fn().mockResolvedValue(undefined) };
  const rootAuth = { login: vi.fn().mockResolvedValue(undefined) };
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  const route = { snapshot: { queryParamMap: { get: vi.fn().mockReturnValue(null) } } };
  return { component: new LoginComponent(auth as never, rootAuth as never, router as never, route as never), auth, rootAuth, router };
}

describe('LoginComponent authentication routing', () => {
  it('routes the fixed admin username to Root authentication', async () => {
    const { component, auth, rootAuth, router } = createComponent();
    component.email = 'admin';
    component.password = 'test-password';

    await component.submit();

    expect(rootAuth.login).toHaveBeenCalledWith('admin', 'test-password');
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/root/admins');
  });

  it('keeps email login on the existing Supabase Auth path', async () => {
    const { component, auth, rootAuth, router } = createComponent();
    component.email = 'staff@example.com';
    component.password = 'test-password';

    await component.submit();

    expect(auth.signIn).toHaveBeenCalledWith('staff@example.com', 'test-password');
    expect(rootAuth.login).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
