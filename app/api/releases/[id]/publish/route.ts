import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { getPrice } from '@/lib/pricing';

interface PublishBody {
  party?: {
    room_id: string;
    scheduled_at: string;
  };
  release_date?: string; // ISO, only used when no party
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const limited = enforceLimit(`user:${user.id}:release:publish`, 5, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as PublishBody | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  // 1. Validate publish eligibility (3 tracks + audio + monthly limit)
  const { error: validationErr } = await supabase.rpc('validate_release_publish', {
    p_release_id: id,
  });
  if (validationErr) return NextResponse.json({ error: validationErr.message }, { status: 400 });

  // 2. Compute price_minimum from tracks count
  const { data: tracks } = await supabase.from('tracks').select('id').eq('release_id', id);
  const trackCount = tracks?.length ?? 0;
  const priceMinimum = parseFloat(getPrice(trackCount));

  const { error: priceErr } = await supabase
    .from('releases')
    .update({ price_minimum: priceMinimum })
    .eq('id', id);
  if (priceErr) return NextResponse.json({ error: priceErr.message }, { status: 400 });

  // 3. Dispatch based on party/no-party
  if (body.party) {
    const { data: partyId, error: partyErr } = await supabase.rpc(
      'validate_and_create_listening_party',
      {
        p_release_id: id,
        p_room_id: body.party.room_id,
        p_scheduled_at: body.party.scheduled_at,
      },
    );
    if (partyErr) return NextResponse.json({ error: partyErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, party_id: partyId });
  }

  // No-party path: immediate or future date
  const now = new Date();
  const rd = body.release_date ? new Date(body.release_date) : now;
  const futureSchedule = rd > now;

  // Max 3 months ahead for no-party scheduled releases
  const maxDate = new Date(now.getTime() + 3 * 30 * 24 * 60 * 60 * 1000);
  if (futureSchedule && rd > maxDate) {
    return NextResponse.json(
      { error: 'Cannot schedule more than 3 months ahead' },
      { status: 400 },
    );
  }

  const nextStatus = futureSchedule ? 'scheduled' : 'published';
  const { error: statusErr } = await supabase
    .from('releases')
    .update({
      status: nextStatus,
      release_date: rd.toISOString(),
    })
    .eq('id', id);
  if (statusErr) return NextResponse.json({ error: statusErr.message }, { status: 400 });

  // Fan out notifications immediately when the release goes live now.
  // Scheduled releases get their fan-out from cron_publish_future_releases
  // (phase 4 task — cron will call the same RPC).
  if (nextStatus === 'published') {
    await supabase.rpc('fanout_release_notification', { p_release_id: id });
  }

  return NextResponse.json({ ok: true });
}
