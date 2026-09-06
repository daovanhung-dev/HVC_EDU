import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import type { AppRole, Profile } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly role = signal<AppRole | null>(null);
  private restorePromise: Promise<Session | null> | null = null;
  private refreshPromise: Promise<Session | null> | null = null;

  constructor(private readonly supabase: SupabaseService, private readonly router: Router) {
    void this.refreshSession().catch(() => this.clearProfile());
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
      if (session) void this.loadProfile().catch(() => this.clearProfile()); else this.clearProfile();
    });
  }

  async refreshSession(): Promise<Session | null> {
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = this.restoreSession().finally(() => { this.restorePromise = null; });
    return this.restorePromise;
  }

  private async restoreSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (error) throw error;
    this.session.set(data.session);
    this.user.set(data.session?.user ?? null);
    if (!data.session) this.clearProfile();
    return data.session;
  }

  async refreshAccessToken(): Promise<Session | null> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refreshAccessTokenOnce().finally(() => { this.refreshPromise = null; });
    return this.refreshPromise;
  }

  private async refreshAccessTokenOnce(): Promise<Session | null> {
    const { data, error } = await this.supabase.client.auth.refreshSession();
    if (error) throw error;
    this.session.set(data.session);
    this.user.set(data.session?.user ?? null);
    if (data.session) await this.loadProfile(); else this.clearProfile();
    return data.session;
  }

  async expireSession(): Promise<void> {
    this.session.set(null);
    this.user.set(null);
    this.clearProfile();
    try {
      await this.supabase.client.auth.signOut({ scope: 'local' });
    } catch {
      // Local auth state is already cleared; a failed remote sign-out is harmless.
    }
    if (!this.router.url.startsWith('/login')) {
      await this.router.navigateByUrl('/login?reason=session-expired');
    }
  }

  async loadProfile(): Promise<Profile | null> {
    const userId = this.user()?.id;
    if (!userId) return null;
    const { data, error } = await this.supabase.client.from('profiles').select('user_id,center_id,full_name,role,staff_id,active').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const profile = (data ?? null) as Profile | null;
    this.profile.set(profile);
    this.role.set(profile?.role ?? null);
    return profile;
  }

  clearProfile(): void { this.profile.set(null); this.role.set(null); }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.session.set(data.session);
    this.user.set(data.user);
    await this.loadProfile();
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
    this.session.set(null);
    this.user.set(null);
    this.clearProfile();
  }

  async resetPassword(email: string): Promise<void> {
    const redirectTo = new URL('reset-password', document.baseURI).toString();
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.client.auth.updateUser({ password });
    if (error) throw error;
  }
}
