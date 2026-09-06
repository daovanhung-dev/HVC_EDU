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
