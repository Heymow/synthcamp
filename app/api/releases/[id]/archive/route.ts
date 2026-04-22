import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Check no live party exists for this release
  const { data: liveParty } = await supabase
    .from('listening_parties')
    .select('id')
    .eq('release_id', id)
    .eq('status', 'live')
    .maybeSingle();
  if (liveParty) {
    return NextResponse.json(
      { error: 'Cannot archive during live party' },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('releases')
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
