import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trackId } = await params;

  // Dedupe floods from the same caller on the same track (anonymous OK).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const limited = enforceLimit(`ip:${ip}:track:${trackId}:play`, 1, 60 * 30);
  if (limited) return limited;

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('increment_track_play', { p_track_id: trackId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
