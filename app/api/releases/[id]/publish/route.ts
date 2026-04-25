import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import { getPrice } from '@/lib/pricing';
import { renderReleasePublishedEmail, sendEmail } from '@/lib/mailer';

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

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

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
    await sendReleasePublishedEmails(supabase, id);
  }

  return NextResponse.json({ ok: true });
}

async function sendReleasePublishedEmails(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  releaseId: string,
): Promise<void> {
  try {
    // Fetch the release + artist profile (needed for email content).
    const { data: rel } = await supabase
      .from('releases')
      .select(
        'title, slug, artist:profiles!releases_artist_id_fkey(id, display_name, slug)',
      )
      .eq('id', releaseId)
      .single();
    if (!rel) return;
    const r = rel as unknown as {
      title: string;
      slug: string;
      artist: { id: string; display_name: string; slug: string | null } | null;
    };
    if (!r.artist) return;

    // Query the artist's followers' emails via admin API — SELECT on
    // auth.users isn't exposed through PostgREST. We fan out via the
    // already-existing notification rows (which have user_id) and look
    // up emails in batch using supabase.auth.admin.
    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('followed_id', r.artist.id);
    if (!followers || followers.length === 0) return;

    const { subject, html, text } = renderReleasePublishedEmail({
      artistName: r.artist.display_name,
      artistSlug: r.artist.slug,
      releaseTitle: r.title,
      releaseSlug: r.slug,
    });

    // Pull emails from auth.users via the admin API (service-role cookie-
    // backed client already has the power). We use listUsers once and map.
    const { data: usersPage } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    const byId = new Map<string, string | undefined>();
    for (const u of usersPage?.users ?? []) byId.set(u.id, u.email ?? undefined);

    await Promise.all(
      followers.map(async (f) => {
        const email = byId.get(f.follower_id);
        if (!email) return;
        await sendEmail({ to: email, subject, html, text });
      }),
    );
  } catch (err) {
    console.error('[publish] email fanout failed:', err);
  }
}
