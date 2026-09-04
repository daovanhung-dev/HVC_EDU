import { Injectable } from '@angular/core';
import { SupabaseService } from '../supabase/supabase.service';
import type { ApiResponse } from './api-response.model';
import { ApiError } from './api-error';

@Injectable({ providedIn: 'root' })
export class EdgeFunctionService {
  constructor(private readonly supabase: SupabaseService) {}

  async invoke<T>(name: string, body: unknown = {}, idempotencyKey?: string): Promise<T> {
    const { data, error } = await this.supabase.client.functions.invoke<ApiResponse<T>>(name, {
      body: body as Record<string, unknown>,
      headers: idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : undefined,
    });
    if (error) throw error;
    if (!data?.success) throw new ApiError(data?.error);
    return data.data as T;
  }
}
