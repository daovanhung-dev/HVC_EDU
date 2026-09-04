import { withSupabase } from 'npm:@supabase/server@^1';
import { requireProfile } from '../_shared/auth.ts';
import { errorResponse, finish, preflight } from '../_shared/rpc.ts';
import { jsonBody, requiredUuid } from '../_shared/validation.ts';
import { ok } from '../_shared/response.ts';
export default { fetch: withSupabase({ auth: 'user' }, async (request, ctx: any) => {
  const traceId = crypto.randomUUID();
  if (request.method === 'OPTIONS') return preflight(request);
  try {
    await requireProfile(ctx, ['ADMIN','ACCOUNTANT']);
    const body = await jsonBody<{ period_id?: string }>(request);
    const { data, error } = await ctx.supabase.from('v_tuition_period_summary').select('*').eq('period_id', requiredUuid(body.period_id));
    if (error) throw error;
    const rows = data ?? [];
    const totals = rows.reduce((sum: any, row: any) => ({ total_due: sum.total_due + Number(row.total_due ?? 0), total_paid: sum.total_paid + Number(row.total_paid ?? 0), total_debt: sum.total_debt + Number(row.total_debt ?? 0) }), { total_due: 0, total_paid: 0, total_debt: 0 });
    return finish(request, ok({ rows, totals, collection_rate: totals.total_due ? totals.total_paid / totals.total_due : 1 }, traceId));
  } catch (error) { return errorResponse(error, request, traceId); }
}) };
