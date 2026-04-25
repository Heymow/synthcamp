import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';

export async function POST() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:become-artist`, 5, 3600);
  if (limited) return limited;

  const { data: profile } = await supabase
    .from('profiles')
    .select('slug')
    .eq('id', user.id)
    .single();

  if (!profile?.slug) {
    return NextResponse.json(
      { error: 'Set a slug first (from /settings/profile)' },
      { status: 400 },
    );
  }

  const { error } = await supabase.from('profiles').update({ is_artist: true }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
