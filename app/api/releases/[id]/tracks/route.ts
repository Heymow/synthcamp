import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import type { Database } from '@/lib/database.types';

type TrackInsert = Database['public']['Tables']['tracks']['Insert'];

interface AddTrackBody {
  title?: string;
  track_number?: number;
  duration_seconds?: number;
  audio_source_key?: string | null;
  credit_category?: Database['public']['Tables']['tracks']['Row']['credit_category'];
  credit_tags?: string[] | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: releaseId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const limited = enforceLimit(`user:${user.id}:track:create`, 30, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as AddTrackBody | null;
  if (
    !body ||
    !body.title ||
    typeof body.track_number !== 'number' ||
    typeof body.duration_seconds !== 'number'
  ) {
    return NextResponse.json(
      { error: 'title, track_number, duration_seconds required' },
      { status: 400 },
    );
  }

  const insertPayload: TrackInsert = {
    release_id: releaseId,
    track_number: body.track_number,
    title: body.title,
    duration_seconds: body.duration_seconds,
    audio_source_key: body.audio_source_key ?? null,
    credit_category: body.credit_category ?? null,
    credit_tags: body.credit_tags ?? null,
  };

  const { data, error } = await supabase
    .from('tracks')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
