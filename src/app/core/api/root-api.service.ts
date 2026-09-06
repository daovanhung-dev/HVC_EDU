import { Injectable } from '@angular/core';
import { ApiError } from './api-error';
import type { ApiResponse } from './api-response.model';
import { SUPABASE_CONFIG } from '../config/supabase.constants';

@Injectable({ providedIn: 'root' })
export class RootApiService {
  async invoke<T>(functionName: string, body: unknown = {}, accessToken?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_CONFIG.publishableKey,
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ApiError(null, 'Không thể kết nối máy chủ Root.');
    }

    let payload: ApiResponse<T> | null = null;
    try { payload = await response.json() as ApiResponse<T>; } catch { /* handled below */ }
    if (!response.ok || !payload?.success) throw new ApiError(payload?.error, response.status === 401 ? 'Phiên Root không hợp lệ hoặc đã hết hạn.' : 'Thao tác Root thất bại.');
    return payload.data as T;
  }
}

