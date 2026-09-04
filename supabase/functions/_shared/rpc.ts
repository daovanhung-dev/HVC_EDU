import { errorResponse } from './error.ts';
import { preflight, withCors } from './response.ts';

export async function callRpc(ctx: any, rpcName: string, params: Record<string, unknown>) {
  const { data, error } = await ctx.supabase.rpc(rpcName, params);
  if (error) throw error;
  return data;
}

export function finish(request: Request, response: Response): Response {
  return withCors(response, request);
}

export { errorResponse, preflight };
