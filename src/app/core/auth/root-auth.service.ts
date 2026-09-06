import { Injectable, signal } from '@angular/core';
import { RootApiService } from '../api/root-api.service';

export type RootSession = { access_token: string; expires_at: string; username: string };

const STORAGE_KEY = 'hvc.root.session';

@Injectable({ providedIn: 'root' })
export class RootAuthService {
  readonly session = signal<RootSession | null>(this.readSession());

  constructor(private readonly api: RootApiService) {}

  accessToken(): string | null {
    const current = this.session();
    if (!current || new Date(current.expires_at).getTime() <= Date.now()) {
      this.clearSession();
      return null;
    }
    return current.access_token;
  }

  isAuthenticated(): boolean { return !!this.accessToken(); }

  async login(username: string, password: string): Promise<void> {
    const result = await this.api.invoke<RootSession>('root-auth', { action: 'LOGIN', username, password });
    if (!result?.access_token || !result.expires_at) throw new Error('Phiên Root trả về không hợp lệ.');
    this.session.set(result);
    this.persist(result);
  }

  async logout(): Promise<void> {
    const token = this.accessToken();
    try {
      if (token) await this.api.invoke('root-auth', { action: 'LOGOUT' }, token);
    } finally {
      this.clearSession();
    }
  }

  clearSession(): void {
    this.session.set(null);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
  }

  private readSession(): RootSession | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<RootSession>;
      if (typeof value.access_token !== 'string' || typeof value.expires_at !== 'string' || typeof value.username !== 'string') return null;
      if (new Date(value.expires_at).getTime() <= Date.now()) { sessionStorage.removeItem(STORAGE_KEY); return null; }
      return value as RootSession;
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private persist(value: RootSession): void {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
}

