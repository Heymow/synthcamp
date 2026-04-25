import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { renderPartyReminderEmail, sendEmail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const REMINDER_WINDOW_MIN = 30;

/**
 * Cron endpoint — hit every 2–5 minutes by an external scheduler with the
 * shared CRON_SECRET. Atomically claims scheduled parties starting in
 * <= REMINDER_WINDOW_MIN (the claim sets reminder_sent_at in the same
 * statement so two overlapping cron ticks can't double-fire), then notifies
 * each claimed party's alert subscribers (in-app + email). If anything
 * downstream fails for a given party we roll back its reminder_sent_at so
 * the next tick retries — at-least-once delivery beats silent drops.
 *
 * Set CRON_SECRET on Railway and hit:
 *   POST https://synthcamp.net/api/cron/party-reminders
 *   Header: X-Cron-Secret: <value>
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Constant-time compare so a bare `!==` doesn't leak length / prefix info
  // through early-out timing. Buffers must be the same length for
  // timingSafeEqual; we explicitly fall back to false otherwise.
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(secret ?? '', 'utf8');
  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseServiceRoleClient();
  const now = new Date();

  // Atomic claim: this RPC runs a single UPDATE…RETURNING that flips
  // reminder_sent_at as it picks the rows, so a second overlapping cron run
  // sees an empty result set instead of re-firing the same party.
  const { data: parties, error: claimErr } = await supabase.rpc(
    'claim_party_reminders',
    { p_window_minutes: REMINDER_WINDOW_MIN },
  );
  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }
  const claimed = parties ?? [];
  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, parties: 0, emails: 0 });
  }

  // Batch fetch alert subscribers for every claimed party in one round-trip,
  // then bucket by party_id in JS. Avoids the N+1 we had with a per-party
  // .from('party_alerts') call.
  const partyIds = claimed.map((p) => p.party_id);
  const { data: alertRows, error: alertsErr } = await supabase
    .from('party_alerts')
    .select('party_id, user_id')
    .in('party_id', partyIds);
  if (alertsErr) {
    // Fail loud: rolling back every claimed marker because we never even
    // got far enough to know who to email.
    const { error: rollbackErr } = await supabase
      .from('listening_parties')
      .update({ reminder_sent_at: null })
      .in('id', partyIds);
    if (rollbackErr) {
      // Rollback itself failed — these parties stay claimed forever
      // unless a human/reaper intervenes. Mark CRITICAL so it's
      // grep-able in Railway logs.
      console.error(
        `[cron] CRITICAL rollback failed for ${partyIds.join(',')}: ${rollbackErr.message}`,
      );
    }
    return NextResponse.json({ error: alertsErr.message }, { status: 500 });
  }

  const subscribersByParty = new Map<string, string[]>();
  const allSubscriberIds = new Set<string>();
  for (const row of alertRows ?? []) {
    const list = subscribersByParty.get(row.party_id) ?? [];
    list.push(row.user_id);
    subscribersByParty.set(row.party_id, list);
    allSubscriberIds.add(row.user_id);
  }

  // Single email-resolution RPC for the union of all subscribers across
  // every claimed party. The RPC takes a uuid[] and dedupes naturally.
  const emailByUser = new Map<string, string>();
  if (allSubscriberIds.size > 0) {
    const { data: emailRows, error: emailErr } = await supabase.rpc(
      'get_user_emails',
      { p_ids: Array.from(allSubscriberIds) },
    );
    if (emailErr) {
      const { error: rollbackErr } = await supabase
        .from('listening_parties')
        .update({ reminder_sent_at: null })
        .in('id', partyIds);
      if (rollbackErr) {
        console.error(
          `[cron] CRITICAL rollback failed for ${partyIds.join(',')}: ${rollbackErr.message}`,
        );
      }
      return NextResponse.json({ error: emailErr.message }, { status: 500 });
    }
    for (const row of emailRows ?? []) {
      if (row.email) emailByUser.set(row.id, row.email);
    }
  }

  // Email jobs are dispatched after we've assembled them all so a slow
  // Brevo call doesn't blow past the cron-job.org free-tier ~30s budget.
  const emailJobs: Array<{ to: string; subject: string; html: string; text: string }> = [];

  await Promise.all(
    claimed.map(async (p) => {
      try {
        const minutesUntilStart = Math.max(
          1,
          Math.round((new Date(p.scheduled_at).getTime() - now.getTime()) / 60_000),
        );
        const artistName = p.artist_name ?? 'Unknown';
        const releaseTitle = p.release_title ?? 'Party';
        const roomName = p.room_name ?? 'SynthCamp';

        const subIds = subscribersByParty.get(p.party_id) ?? [];
        if (subIds.length === 0) {
          return;
        }

        const { error: notifErr } = await supabase.from('notifications').insert(
          subIds.map((uid) => ({
            user_id: uid,
            kind: 'party_reminder' as const,
            payload: {
              party_id: p.party_id,
              release_title: releaseTitle,
              artist_name: artistName,
              room_name: roomName,
              scheduled_at: p.scheduled_at,
              minutes_until_start: minutesUntilStart,
            },
          })),
        );
        if (notifErr) {
          throw new Error(`notifications insert failed: ${notifErr.message}`);
        }

        const { subject, html, text } = renderPartyReminderEmail({
          partyId: p.party_id,
          artistName,
          releaseTitle,
          roomName,
          scheduledAt: p.scheduled_at,
          minutesUntilStart,
        });

        for (const uid of subIds) {
          const to = emailByUser.get(uid);
          if (to) emailJobs.push({ to, subject, html, text });
        }
      } catch (err) {
        // Roll back the claim so the next cron tick retries this party.
        // Silently dropping a reminder is far worse than firing twice.
        console.error(`[cron] party-reminders failed for ${p.party_id}:`, err);
        const { error: rollbackErr } = await supabase
          .from('listening_parties')
          .update({ reminder_sent_at: null })
          .eq('id', p.party_id);
        if (rollbackErr) {
          console.error(
            `[cron] CRITICAL rollback failed for ${p.party_id}: ${rollbackErr.message}`,
          );
        }
      }
    }),
  );

  console.log(`[cron] party-reminders: ${claimed.length} party/ies, ${emailJobs.length} emails to send`);
  await Promise.all(emailJobs.map((job) => sendEmail(job)));

  return NextResponse.json({
    ok: true,
    parties: claimed.length,
    emails_sent: emailJobs.length,
  });
}
