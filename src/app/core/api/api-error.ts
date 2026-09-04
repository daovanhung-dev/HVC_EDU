import type { ApiErrorBody } from './api-response.model';
export class ApiError extends Error {
  readonly code: string;
  readonly details: unknown;
  constructor(body: ApiErrorBody | null | undefined, fallback = 'Thao tác thất bại') {
    super(body?.message ?? fallback);
    this.name = 'ApiError';
    this.code = body?.code ?? 'INTERNAL_ERROR';
    this.details = body?.details;
  }
}
