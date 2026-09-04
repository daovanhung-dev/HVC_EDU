type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => {
        maybeSingle: () => Promise<{ data: { role?: string; center_id?: string; active?: boolean } | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function requireRole(supabase: SupabaseLike, userId: string, allowed: string[]) {
  const { data, error } = await supabase.from('profiles').select('role,center_id,active').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.active || !data.role || !allowed.includes(data.role)) throw new Error('FORBIDDEN');
  return { role: data.role, centerId: data.center_id as string };
}
