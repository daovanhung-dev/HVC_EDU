import { withSupabase } from 'npm:@supabase/server@^1';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString } from '../_shared/validation.ts';
import { getRootAdminClient, bearerToken, randomToken, requestIpHash, sha256Hex } from '../_shared/root.ts';
import { verifyPassword } from '../_shared/root-crypto.ts';
import { ok } from '../_shared/response.ts';

type Payload = { action?: string; username?: string; password?: string };
type LoginAttempt = { failure_count: number; window_started_at: string; locked_until: string | null };

function configuredLoginName(): string {
  const value = Deno.env.get('ROOT_LOGIN_NAME')?.trim().toLowerCase();
  if (!value) throw new Error('ROOT_BACKEND_NOT_CONFIGURED');
  return value;
}

function sessionTtlSeconds(): number {
  const value = Number(Deno.env.get('ROOT_SESSION_TTL_SECONDS') ?? '1800');
  if (!Number.isSafeInteger(value) || value < 300 || value > 86_400) throw new Error('ROOT_BACKEND_NOT_CONFIGURED');
  return value;
}

async function recordFailure(client: any, username: string, ipHash: string): Promise<void> {
  const now = Date.now();
  const { data, error } = await client.from('root_login_attempts')
    .select('failure_count,window_started_at,locked_until')
    .eq('username', username)
    .eq('ip_hash', ipHash)
    .maybeSingle();
  if (error) throw error;

  const current = data as LoginAttempt | null;
  if (current?.locked_until && new Date(current.locked_until).getTime() > now) throw new Error('ROOT_RATE_LIMITED');

  const windowExpired = !current || now - new Date(current.window_started_at).getTime() >= 15 * 60 * 1000;
  const failureCount = windowExpired ? 1 : current.failure_count + 1;
  const lockedUntil = failureCount >= 5 ? new Date(now + 15 * 60 * 1000).toISOString() : null;
  const { error: writeError } = await client.from('root_login_attempts').upsert({
    username,
    ip_hash: ipHash,
    failure_count: failureCount,
    window_started_at: windowExpired ? new Date(now).toISOString() : current.window_started_at,
    locked_until: lockedUntil,
    updated_at: new Date(now).toISOString(),
  }, { onConflict: 'username,ip_hash' });
  if (writeError) throw writeError;
  if (lockedUntil) throw new Error('ROOT_RATE_LIMITED');
}

async function clearFailures(client: any, username: string, ipHash: string): Promise<void> {
  const { error } = await client.from('root_login_attempts').delete().eq('username', username).eq('ip_hash', ipHash);
  if (error) throw error;
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (request, ctx: any) => {
    const traceId = crypto.randomUUID();
    if (request.method === 'OPTIONS') return preflight(request);

    try {
      const client = getRootAdminClient(ctx);
      const body = await jsonBody<Payload>(request);
      const action = requiredString(body.action).toUpperCase();

      if (action === 'LOGOUT') {
        const token = bearerToken(request);
        if (token) {
          const tokenHash = await sha256Hex(token);
          const { error } = await client.from('root_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', tokenHash);
          if (error) throw error;
        }
        return finish(request, ok({ logged_out: true }, traceId));
      }

      if (action !== 'LOGIN') throw new Error('VALIDATION_ERROR');
      const username = requiredString(body.username).toLowerCase();
      const password = requiredString(body.password);
      const loginName = configuredLoginName();
      const ipHash = await requestIpHash(request);
      const passwordHash = Deno.env.get('ROOT_PASSWORD_HASH');
      if (!passwordHash) throw new Error('ROOT_BACKEND_NOT_CONFIGURED');

      let passwordMatches = false;
      try {
        passwordMatches = await verifyPassword(password, passwordHash);
      } catch (error) {
        if (error instanceof Error && error.message === 'ROOT_BACKEND_NOT_CONFIGURED') throw error;
      }
      if (username !== loginName || !passwordMatches) {
        await recordFailure(client, loginName, ipHash);
        throw new Error('ROOT_INVALID_CREDENTIALS');
      }

      await clearFailures(client, loginName, ipHash);
      const token = randomToken();
      const expiresAt = new Date(Date.now() + sessionTtlSeconds() * 1000).toISOString();
      const { error } = await client.from('root_sessions').insert({
        token_hash: await sha256Hex(token),
        expires_at: expiresAt,
        ip_hash: ipHash,
        user_agent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
      });
      if (error) throw error;

      return finish(request, ok({ access_token: token, expires_at: expiresAt, username: loginName }, traceId));
    } catch (error) {
      return errorResponse(error, request, traceId);
    }
  }),
};
