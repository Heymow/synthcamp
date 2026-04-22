import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roomId } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to required (ISO dates)' }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  // Public read — no user session required to check calendar
  const { data, error } = await supabase
    .from('listening_parties')
    .select(
      `id, scheduled_at, ends_at, duration_seconds, status,
       artist:profiles!listening_parties_artist_id_fkey(display_name, slug),
       release:releases!listening_parties_release_id_fkey(title, slug)`,
    )
    .eq('room_id', roomId)
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ slots: data ?? [] });
}
