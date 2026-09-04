export type FunctionContext = {
  supabase: { from: (table: string) => any; rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: any }> };
  supabaseAdmin?: { from: (table: string) => any; rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: any }> };
  userClaims?: { id?: string; sub?: string; email?: string; role?: string };
};

export async function requireProfile(ctx: any, allowed?: string[]) {
  const userId = ctx.userClaims?.id ?? ctx.userClaims?.sub;
  if (!userId) throw new Error('UNAUTHENTICATED');
  const { data, error } = await ctx.supabase.from('profiles').select('user_id,center_id,role,staff_id,active').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data?.active) throw new Error('FORBIDDEN');
  if (allowed && !allowed.includes(data.role)) throw new Error('FORBIDDEN');
  return { userId, profile: data };
}

export function idempotencyKey(request: Request): string | null {
  const value = request.headers.get('x-idempotency-key')?.trim();
  return value || null;
}

export async function runIdempotent<T>(
  ctx: any,
  centerId: string,
  request: Request,
  operation: string,
  execute: () => Promise<T>,
): Promise<T> {
  const key = idempotencyKey(request);
  if (!key) return execute();
  const admin = ctx.supabaseAdmin;
  if (!admin) throw new Error('INTERNAL_ERROR');
  const existing = await admin.from('idempotency_requests')
    .select('status,result_json')
    .eq('center_id', centerId)
    .eq('operation', operation)
    .eq('idempotency_key', key)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.status === 'COMPLETED') return existing.data.result_json as T;
  if (existing.data?.status === 'STARTED') throw new Error('IDEMPOTENCY_IN_PROGRESS');
  const created = existing.data?.status === 'FAILED'
    ? await admin.from('idempotency_requests').update({ status: 'STARTED', result_json: null }).eq('center_id', centerId).eq('operation', operation).eq('idempotency_key', key)
    : await admin.from('idempotency_requests').insert({ center_id: centerId, operation, idempotency_key: key, status: 'STARTED' });
  if (created.error) {
    if (String(created.error.code ?? '').includes('23505')) throw new Error('IDEMPOTENCY_IN_PROGRESS');
    throw created.error;
  }
  try {
    const result = await execute();
    const updated = await admin.from('idempotency_requests').update({ status: 'COMPLETED', result_json: result }).eq('center_id', centerId).eq('operation', operation).eq('idempotency_key', key);
    if (updated.error) throw updated.error;
    return result;
  } catch (error) {
    await admin.from('idempotency_requests').update({ status: 'FAILED' }).eq('center_id', centerId).eq('operation', operation).eq('idempotency_key', key);
    throw error;
  }
}
