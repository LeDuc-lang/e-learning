import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface CurrentProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'admin';
}

export async function getCurrentUserWithProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, profile: null as CurrentProfile | null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, email, full_name, role')
    .eq('user_id', user.id)
    .maybeSingle<CurrentProfile>();

  return { supabase, user, profile };
}

export function isAdmin(profile: CurrentProfile | null) {
  return profile?.role === 'admin';
}
