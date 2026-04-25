import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Count of unread notifications for the given profile. Returns 0 if there
 * are no rows or the query fails. No caching yet (Phase 3 concern).
 */
export async function getUnreadNotificationsCount(profileId: string): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profileId)
    .is('read_at', null);
  return count ?? 0;
}
