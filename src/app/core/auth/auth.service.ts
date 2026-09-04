import { Injectable, signal } from '@angular/core';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);

  constructor(private readonly supabase: SupabaseService) {
    void this.refreshSession();
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      this.user.set(session?.user ?? null);
    });
  }

  async refreshSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.client.auth.getSession();
    if (error) throw error;
    this.session.set(data.session);
    this.user.set(data.session?.user ?? null);
    return data.session;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.session.set(data.session);
    this.user.set(data.user);
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.client.auth.signOut();
    if (error) throw error;
    this.session.set(null);
    this.user.set(null);
  }
}
