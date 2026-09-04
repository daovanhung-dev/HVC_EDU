/**
 * Lightweight checked-in schema contract for the browser services. Run
 * `supabase gen types typescript --local` after starting Supabase to refresh
 * the full generated contract when the local database is available.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: Json }>;
    Enums: { app_role: 'ADMIN' | 'ACCOUNTANT' | 'TEACHER' | 'ASSISTANT'; period_status: 'OPEN' | 'CLOSING' | 'CLOSED' };
  };
};
