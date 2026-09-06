import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

function serviceWithSpies() {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    refreshSession: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  };
  const router = {
    url: '/classes',
    navigateByUrl: vi.fn().mockResolvedValue(true),
  };
  const service = new AuthService({ client: { auth } } as never, router as never);
  vi.spyOn(service, 'loadProfile').mockResolvedValue(null);
  return { service, auth, router };
}

describe('AuthService access-token recovery', () => {
  it('refreshes the access token and updates the current session', async () => {
    const { service, auth } = serviceWithSpies();
    const session = { access_token: 'new-token', user: { id: 'user-1' } };
    auth.refreshSession.mockResolvedValue({ data: { session }, error: null });

    await expect(service.refreshAccessToken()).resolves.toBe(session);

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(service.session()).toBe(session);
    expect(service.user()).toBe(session.user);
  });

  it('shares one refresh request between concurrent callers', async () => {
    const { service, auth } = serviceWithSpies();
    let resolveRefresh!: (value: { data: { session: object }; error: null }) => void;
    auth.refreshSession.mockReturnValue(new Promise((resolve) => { resolveRefresh = resolve; }));

    const first = service.refreshAccessToken();
    const second = service.refreshAccessToken();
    resolveRefresh({ data: { session: { access_token: 'shared-token' } }, error: null });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('clears the local session and navigates to login when the session expires', async () => {
    const { service, auth, router } = serviceWithSpies();
    service.session.set({ access_token: 'expired' } as never);
    service.user.set({ id: 'user-1' } as never);
    service.profile.set({ user_id: 'user-1' } as never);

    await service.expireSession();

    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login?reason=session-expired');
    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.profile()).toBeNull();
    expect(service.role()).toBeNull();
  });
});
