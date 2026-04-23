import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * Block write actions from banned users. Call right after the auth check
 * in any mutating API route. Returns a NextResponse to return early, or
 * null to proceed.
 */
export async function requireActiveAccount(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from('profiles')
    .select('banned_at')
    .eq('id', userId)
    .maybeSingle();
  if (data?.banned_at) {
    return NextResponse.json(
      {
        error:
          'Your account has been suspended. You can review your settings and retrieve pending payouts, but you can no longer publish or interact on SynthCamp.',
      },
      { status: 403 },
    );
  }
  return null;
}
