import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

export async function getProfileBySlug(slug: string): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  return data;
}
