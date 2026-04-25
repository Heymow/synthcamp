import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireActiveAccount } from '@/lib/api/require-active';

/**
 * Result of an admin gate. Either you have a `supabase` + `user` to keep
 * working with, or `err` is a NextResponse to return early.
 */
export interface RequireAdminResult {
  supabase: SupabaseClient<Database>;
  user: { id: string } | null;
  err: NextResponse | null;
}

/**
 * Consolidated admin check used by every /api/admin/** route. Returns the
 * already-instantiated supabase client (so callers don't double-instantiate)
 * along with the resolved user. If the caller isn't authenticated or isn't
 * flagged `is_admin = true`, `err` is set to a ready-to-return NextResponse.
 *
 * Pattern:
 *   const { supabase, err } = await requireAdmin();
 *   if (err) return err;
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      err: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }),
    };
  }
  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    return {
      supabase,
      user,
      err: NextResponse.json({ error: 'Admin only' }, { status: 403 }),
    };
  }
  // Banned admins must not be able to mutate via admin routes. Even if
  // is_admin remains true after a ban, the active-account gate denies
  // suspended users.
  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) {
    return { supabase, user, err: suspended };
  }
  return { supabase, user, err: null };
}
