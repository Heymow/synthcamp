import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
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

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:track:create`, 30, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as AddTrackBody | null;
  if (!body || !body.title || typeof body.duration_seconds !== 'number') {
    return NextResponse.json(
      { error: 'title, duration_seconds required' },
      { status: 400 },
    );
  }

  // Always compute the next track_number server-side. Any value sent by the
  // client is ignored — prevents unique-constraint collisions when the
  // wizard is resumed with a stale local state.
  //
  // Two concurrent uploads can still race here: both SELECT max=N, both try
  // to INSERT N+1, and the second hits the (release_id, track_number) unique
  // constraint with code 23505. Retry up to 5 times — on each attempt we
  // re-read the max so the retry sees the row the racer just inserted.
  const MAX_ATTEMPTS = 5;
  let lastError: { code?: string; message: string } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: existing, error: lookupErr } = await supabase
      .from('tracks')
      .select('track_number')
      .eq('release_id', releaseId)
      .order('track_number', { ascending: false })
      .limit(1);
    if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 400 });
    const nextNumber = (existing?.[0]?.track_number ?? 0) + 1;

    const insertPayload: TrackInsert = {
      release_id: releaseId,
      track_number: nextNumber,
      title: body.title,
      duration_seconds: body.duration_seconds,
      audio_source_key: body.audio_source_key ?? null,
      credit_category: body.credit_category ?? null,
      credit_tags: body.credit_tags ?? null,
    };

    const { data, error } = await supabase
      .from('tracks')
      .insert(insertPayload)
      .select('id, track_number')
      .single();

    if (!error) {
      return NextResponse.json(data, { status: 201 });
    }

    // Postgres foreign_key_violation — the parent release was deleted
    // between the max-lookup and the insert. Retrying won't bring it
    // back; surface a clean 404 instead of leaking the raw FK message.
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    // Postgres unique_violation — another concurrent insert grabbed the same
    // track_number. Loop back to re-read the max and retry. Any other error
    // is fatal.
    if (error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    lastError = error;
  }

  return NextResponse.json(
    {
      error: lastError?.message ?? 'Failed to allocate track_number after retries',
    },
    { status: 409 },
  );
}
