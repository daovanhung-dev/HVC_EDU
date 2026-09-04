import { Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private readonly supabase: SupabaseService) {}
  table(name: string): any { return this.supabase.client.from(name); }
  async list<T>(name: string, select = '*', order?: string): Promise<T[]> {
    let query = this.table(name).select(select);
    if (order) query = query.order(order);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as T[];
  }
}
