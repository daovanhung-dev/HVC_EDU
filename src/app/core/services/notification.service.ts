import { Injectable, signal } from '@angular/core';
import { EdgeFunctionService } from '../api/edge-function.service';
import { SupabaseService } from '../supabase/supabase.service';

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'BLOCKED';
  action_route: string | null;
  metadata?: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly unreadCount = signal(0);

  constructor(private readonly supabase: SupabaseService, private readonly edge: EdgeFunctionService) {}

  async list(): Promise<Notification[]> {
    const result = await this.supabase.client.from('notifications').select('id,type,title,message,severity,action_route,metadata,read_at,created_at').order('created_at', { ascending: false }).limit(100);
    if (result.error) throw result.error;
    const rows = (result.data ?? []) as Notification[];
    this.unreadCount.set(rows.filter((row) => !row.read_at).length);
    return rows;
  }

  async refreshCount(): Promise<number> {
    const result = await this.supabase.client.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
    if (result.error) throw result.error;
    this.unreadCount.set(result.count ?? 0);
    return result.count ?? 0;
  }

  async markRead(id: string): Promise<void> {
    await this.edge.invoke('mark-notification-read', { notification_id: id });
    this.unreadCount.update((value) => Math.max(0, value - 1));
  }

  async markAllRead(): Promise<void> {
    await this.edge.invoke('mark-all-notifications-read');
    this.unreadCount.set(0);
  }

  send(payload: { scope: 'ALL' | 'ROLE' | 'USER'; role?: string; recipient_user_id?: string; title: string; message: string; severity?: string; action_route?: string }): Promise<any> {
    return this.edge.invoke('send-notification', payload, `notification:${Date.now()}`);
  }
}
