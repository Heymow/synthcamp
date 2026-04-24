import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { renderPartyReminderEmail, sendEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const REMINDER_WINDOW_MIN = 30;

interface PartyRow {
  id: string;
  scheduled_at: string;
  release: {
    title: string;
    artist: { display_name: string } | null;
  } | null;
  room: { name: string } | null;
}

/**
 * Cron endpoint — hit every 2–5 minutes by an external scheduler with the
 * shared CRON_SECRET. Finds scheduled parties starting in <= REMINDER_WINDOW_MIN
 * and notifies their alert subscribers (in-app + email), then marks the
 * party so we don't re-fire.
 *
 * Set CRON_SECRET on Railway and hit:
 *   POST https://synthcamp.net/api/cron/party-reminders
 *   Header: X-Cron-Secret: <value>
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60 * 1000);

  const { data: partiesRaw, error: partiesErr } = await supabase
    .from('listening_parties')
    .select(
      `id, scheduled_at,
       release:releases!listening_parties_release_id_fkey(
         title,
         artist:profiles!releases_artist_id_fkey(display_name)
       ),
       room:rooms(name)`,
    )
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', windowEnd.toISOString());
  if (partiesErr) {
    return NextResponse.json({ error: partiesErr.message }, { status: 500 });
  }
  const parties = (partiesRaw as unknown as PartyRow[] | null) ?? [];
  if (parties.length === 0) {
    return NextResponse.json({ ok: true, parties: 0, emails: 0 });
  }

  // Collect email jobs to dispatch after we respond so the HTTP response
  // doesn't wait on SMTP (cron-job.org free tier cuts at ~30s).
  const emailJobs: Array<{ to: string; subject: string; html: string; text: string }> = [];

  await Promise.all(
    parties.map(async (p) => {
      const minutesUntilStart = Math.max(
        1,
        Math.round((new Date(p.scheduled_at).getTime() - now.getTime()) / 60_000),
      );
      const artistName = p.release?.artist?.display_name ?? 'Unknown';
      const releaseTitle = p.release?.title ?? 'Party';
      const roomName = p.room?.name ?? 'SynthCamp';

      const { data: subscribers } = await supabase
        .from('party_alerts')
        .select('user_id')
        .eq('party_id', p.id);
      const subIds = (subscribers ?? []).map((s) => s.user_id);

      if (subIds.length > 0) {
        await supabase.from('notifications').insert(
          subIds.map((uid) => ({
            user_id: uid,
            kind: 'party_reminder' as const,
            payload: {
              party_id: p.id,
              release_title: releaseTitle,
              artist_name: artistName,
              room_name: roomName,
              scheduled_at: p.scheduled_at,
              minutes_until_start: minutesUntilStart,
            },
          })),
        );

        // Resolve emails via SECURITY DEFINER RPC (self-hosted GoTrue admin API
        // is unreliable; reading auth.users directly is cleaner).
        const { data: emailRows } = await supabase.rpc('get_user_emails', {
          p_ids: subIds,
        });
        const emails = (emailRows ?? []).map((row) => row.email);

        const { subject, html, text } = renderPartyReminderEmail({
          partyId: p.id,
          artistName,
          releaseTitle,
          roomName,
          scheduledAt: p.scheduled_at,
          minutesUntilStart,
        });

        for (const to of emails) {
          if (to) emailJobs.push({ to, subject, html, text });
        }
      }

      await supabase
        .from('listening_parties')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', p.id);
    }),
  );

  console.log(`[cron] party-reminders: ${parties.length} party/ies, ${emailJobs.length} emails to send`);
  await Promise.all(emailJobs.map((job) => sendEmail(job)));

  return NextResponse.json({
    ok: true,
    parties: parties.length,
    emails_sent: emailJobs.length,
  });
}
