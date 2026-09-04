import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { callRpc, errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';

type Payload = { staff_id?: string; email?: string };

function requireResult<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('EMAIL_INVALID');
  const email = value.trim().toLowerCase();
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

export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);

  try {
    const { profile } = await requireProfile(ctx, ['ADMIN']);
    const body = await jsonBody<Payload>(request);
    const staffId = requiredUuid(body.staff_id);
    const staff = requireResult<any>(await ctx.supabase
      .from('staff')
      .select('id,center_id,code,full_name,staff_type,status,email')
      .eq('id', staffId)
      .eq('center_id', profile.center_id)
      .maybeSingle());
    if (!staff) throw new Error('STAFF_NOT_FOUND');
    if (staff.status !== 'ACTIVE') throw new Error('STAFF_INACTIVE');

    const email = normalizeEmail(body.email ?? staff.email);
    const existingProfile = requireResult<any>(await ctx.supabase
      .from('profiles')
      .select('user_id,staff_id,active')
      .eq('center_id', profile.center_id)
      .eq('staff_id', staffId)
      .maybeSingle());
    if (existingProfile) throw new Error('STAFF_ACCOUNT_EXISTS');
    const emailOwner = requireResult<any>(await ctx.supabase
      .from('staff')
      .select('id')
      .eq('center_id', profile.center_id)
      .eq('email', email)
      .neq('id', staffId)
      .maybeSingle());
    if (emailOwner) throw new Error('CONFLICT');

    const admin = ctx.supabaseAdmin;
    if (!admin?.auth?.admin) throw new Error('INTERNAL_ERROR');
    const inviteOptions = { data: { full_name: staff.full_name, staff_id: staff.id }, ...(resetPasswordUrl(request) ? { redirectTo: resetPasswordUrl(request) } : {}) };
    const invited = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
    if (invited.error) {
      if (invited.data?.user?.id) await admin.auth.admin.deleteUser(invited.data.user.id);
      const message = String(invited.error.message || '').toLowerCase();
      throw new Error(message.includes('already') || message.includes('duplicate') ? 'CONFLICT' : 'STAFF_ACCOUNT_INVITE_FAILED');
    }
    if (!invited.data?.user?.id) throw new Error('STAFF_ACCOUNT_INVITE_FAILED');

    try {
      const linked = await callRpc(ctx, 'rpc_link_staff_account', {
        p_staff_id: staff.id,
        p_user_id: invited.data.user.id,
        p_email: email,
        p_trace_id: traceId,
      });
      return finish(request, ok({ ...(linked as Record<string, unknown>), invite_sent: true }, traceId, 201));
    } catch (linkError) {
      await admin.auth.admin.deleteUser(invited.data.user.id);
      throw linkError;
    }
  } catch (error) {
    return errorResponse(error, request, traceId);
  }
}) };
