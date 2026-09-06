import { afterEach, describe, expect, it, vi } from 'vitest';
import { RootAuthService } from './root-auth.service';

function serviceWithApi() {
  const api = { invoke: vi.fn() };
  return { service: new RootAuthService(api as never), api };
}

describe('RootAuthService', () => {
  afterEach(() => sessionStorage.clear());

  it('stores a successful server-side Root session in sessionStorage', async () => {
    const { service, api } = serviceWithApi();
    const session = { access_token: 'root-token', expires_at: new Date(Date.now() + 60_000).toISOString(), username: 'admin' };
    api.invoke.mockResolvedValue(session);

    await service.login('admin', 'test-password');

    expect(api.invoke).toHaveBeenCalledWith('root-auth', { action: 'LOGIN', username: 'admin', password: 'test-password' });
    expect(service.isAuthenticated()).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('hvc.root.session') ?? '{}')).toMatchObject({ access_token: 'root-token', username: 'admin' });
  });

  it('clears expired sessions without calling the backend', () => {
    sessionStorage.setItem('hvc.root.session', JSON.stringify({ access_token: 'expired', expires_at: new Date(Date.now() - 1_000).toISOString(), username: 'admin' }));
    const { service, api } = serviceWithApi();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.session()).toBeNull();
    expect(api.invoke).not.toHaveBeenCalled();
  });

  it('revokes the server session and clears local state on logout', async () => {
    const { service, api } = serviceWithApi();
    api.invoke.mockResolvedValue({ access_token: 'root-token', expires_at: new Date(Date.now() + 60_000).toISOString(), username: 'admin' });
    await service.login('admin', 'test-password');
    api.invoke.mockResolvedValue({});

    await service.logout();

    expect(api.invoke).toHaveBeenLastCalledWith('root-auth', { action: 'LOGOUT' }, 'root-token');
    expect(service.session()).toBeNull();
    expect(sessionStorage.getItem('hvc.root.session')).toBeNull();
  });
});

