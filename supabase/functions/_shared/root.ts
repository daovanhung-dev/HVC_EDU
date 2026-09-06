export type RootContext = {
  supabaseAdmin?: {
    from: (table: string) => any;
    rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: any }>;
    auth?: { admin?: any };
  };
};

function adminClient(ctx: RootContext): NonNullable<RootContext['supabaseAdmin']> {
  if (!ctx.supabaseAdmin) throw new Error('ROOT_BACKEND_NOT_CONFIGURED');
  return ctx.supabaseAdmin;
}

export function getRootAdminClient(ctx: RootContext): NonNullable<RootContext['supabaseAdmin']> {
  return adminClient(ctx);
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization')?.trim() ?? '';
  if (!value.toLowerCase().startsWith('bearer ')) return null;
  const token = value.slice(7).trim();
  return token || null;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function requestAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function requestIpHash(request: Request): Promise<string> {
  const salt = Deno.env.get('ROOT_IP_HASH_SALT');
  if (!salt) throw new Error('ROOT_BACKEND_NOT_CONFIGURED');
  return sha256Hex(`${salt}:${requestAddress(request)}`);
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function requireRootSession(request: Request, ctx: RootContext): Promise<{ id: string }> {
  const token = bearerToken(request);
  if (!token) throw new Error('ROOT_UNAUTHENTICATED');

  const client = adminClient(ctx);
  const tokenHash = await sha256Hex(token);
  const { data, error } = await client.from('root_sessions')
    .select('id,expires_at,revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;

  const session = data as { id: string; expires_at: string; revoked_at: string | null } | null;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    throw new Error('ROOT_UNAUTHENTICATED');
  }

  const update = await client.from('root_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id);
  if (update?.error) throw update.error;
  return { id: session.id };
}

