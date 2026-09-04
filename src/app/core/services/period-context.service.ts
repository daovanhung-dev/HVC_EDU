import { Injectable, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';

export type AccountingPeriod = { id: string; center_id: string; year: number; month: number; start_date: string; end_date: string; status: 'OPEN' | 'CLOSING' | 'CLOSED'; version: number };
@Injectable({ providedIn: 'root' })
export class PeriodContextService {
  readonly periods = signal<AccountingPeriod[]>([]);
  readonly current = signal<AccountingPeriod | null>(null);
  readonly initialized = signal(false);
  readonly ready: Promise<void>;
  constructor(private readonly supabase: SupabaseService) { this.ready = this.load(); }
  async load(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.from('accounting_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false });
      if (error) throw error;
      const periods = (data ?? []) as AccountingPeriod[];
      this.periods.set(periods);
      const saved = localStorage.getItem('hc_period_id');
      this.current.set(periods.find((p) => p.id === saved) ?? periods[0] ?? null);
    } finally {
      this.initialized.set(true);
    }
  }
  select(period: AccountingPeriod): void { this.current.set(period); localStorage.setItem('hc_period_id', period.id); }
}
