import { withSupabase } from 'npm:@supabase/server@^1';

export default {
  fetch: withSupabase({ auth: 'none' }, async () => {
    return Response.json({ ok: true, service: 'hungcuong-center-management', time: new Date().toISOString() });
  }),
};
