import { withSupabase } from 'npm:@supabase/server@^1';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredString, requiredUuid } from '../_shared/validation.ts';
import { getRootAdminClient, requireRootSession } from '../_shared/root.ts';
import { ok } from '../_shared/response.ts';

type Payload = { operation?: string; full_name?: string; email?: string; center_id?: string; user_id?: string };

function normalizeEmail(value: unknown): string {
  const email = requiredString(value).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(email)) throw new Error('EMAIL_INVALID');
  return email;
}

function resetPasswordUrl(request: Request): string | undefined {
  const configured = Deno.env.get('APP_URL')?.trim().replace(/\/$/, '');
  if (configured) return `${configured}/reset-password`;
  const origin = request.headers.get('origin')?.trim().replace(/\/$/, '');
  if (!origin) return undefined;
  const appBase = origin.endsWith('github.io') ? `${origin}/HVC_EDU` : origin;
  return `${appBase}/reset-password`;
}

function authErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? '').toLowerCase();
  return message.includes('already') || message.includes('duplicate') || message.includes('exists') ? 'ADMIN_ACCOUNT_EXISTS' : 'ADMIN_ACCOUNT_INVITE_FAILED';
}

async function listAccounts(client: any): Promise<unknown> {
  const [profilesResult, centersResult, usersResult] = await Promise.all([
    client.from('profiles').select('user_id,center_id,full_name,role,active,created_at,center:centers(id,code,name)').eq('role', 'ADMIN').order('full_name'),
    client.from('centers').select('id,code,name,status').eq('status', 'ACTIVE').order('code'),
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (centersResult.error) throw centersResult.error;
  if (usersResult.error) throw usersResult.error;

  const users = new Map<string, any>((usersResult.data?.users ?? []).map((user: any) => [user.id, user] as [string, any]));
  const admins = (profilesResult.data ?? []).map((profile: any) => ({
    user_id: profile.user_id,
    email: users.get(profile.user_id)?.email ?? null,
    center_id: profile.center_id,
    center: profile.center,
    full_name: profile.full_name,
    role: profile.role,
    active: profile.active,
    created_at: profile.created_at,
  }));
  return { admins, centers: centersResult.data ?? [] };
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (request, ctx: any) => {
    const traceId = crypto.randomUUID();
    if (request.method === 'OPTIONS') return preflight(request);

    try {
      await requireRootSession(request, ctx);
      const client = getRootAdminClient(ctx) as any;
      const body = await jsonBody<Payload>(request);
      const operation = requiredString(body.operation).toUpperCase();
      const actorLogin = Deno.env.get('ROOT_LOGIN_NAME')?.trim().toLowerCase() || 'admin';

      if (operation === 'LIST') {
        return finish(request, ok(await listAccounts(client), traceId));
      }

      if (operation === 'CREATE') {
        const centerId = requiredUuid(body.center_id);
        const fullName = requiredString(body.full_name);
        const email = normalizeEmail(body.email);
        const center = await client.from('centers').select('id').eq('id', centerId).eq('status', 'ACTIVE').maybeSingle();
        if (center.error) throw center.error;
        if (!center.data) throw new Error('CENTER_NOT_FOUND');

        const inviteOptions = {
          data: { full_name: fullName, role: 'ADMIN', center_id: centerId },
          ...(resetPasswordUrl(request) ? { redirectTo: resetPasswordUrl(request) } : {}),
        };
        const invited = await client.auth.admin.inviteUserByEmail(email, inviteOptions);
        if (invited.error) throw new Error(authErrorCode(invited.error));
        const userId = invited.data?.user?.id;
        if (!userId) throw new Error('ADMIN_ACCOUNT_INVITE_FAILED');

        try {
          const linked = await client.rpc('rpc_root_create_admin', {
            p_user_id: userId,
            p_center_id: centerId,
            p_full_name: fullName,
            p_email: email,
            p_actor_login: actorLogin,
            p_trace_id: traceId,
          });
          if (linked.error) throw linked.error;
          return finish(request, ok({ profile: linked.data, email, invite_sent: true }, traceId, 201));
        } catch (error) {
          await client.auth.admin.deleteUser(userId);
          throw error;
        }
      }

      if (operation === 'DEACTIVATE') {
        const userId = requiredUuid(body.user_id);
        const result = await client.rpc('rpc_root_deactivate_admin', {
          p_user_id: userId,
          p_actor_login: actorLogin,
          p_trace_id: traceId,
        });
        if (result.error) throw result.error;
        return finish(request, ok(result.data, traceId));
      }

      throw new Error('VALIDATION_ERROR');
    } catch (error) {
      return errorResponse(error, request, traceId);
    }
  }),
};
