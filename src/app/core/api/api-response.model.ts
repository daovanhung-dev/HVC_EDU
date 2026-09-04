export type ApiErrorBody = { code: string; message: string; details?: unknown };
export type ApiResponse<T> = { success: boolean; data: T | null; error: ApiErrorBody | null; traceId: string };
