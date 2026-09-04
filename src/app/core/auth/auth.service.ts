import { Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import type { AppRole, Profile } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly role = signal<AppRole | null>(null);

  constructor(private readonly supabase: SupabaseService) {
    void this.refreshSession();
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
      if (session) void this.loadProfile(); else this.clearProfile();
    });
  }

  async refreshSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (error) throw error;
    this.session.set(data.session);
    this.user.set(data.session?.user ?? null);
    if (data.session) await this.loadProfile(); else this.clearProfile();
    return data.session;
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
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }
}
