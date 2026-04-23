import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LiveStatus } from '@/components/party/live-status';
import { WaitButton } from '@/components/party/wait-button';
import { CancelPartyButton } from '@/components/party/cancel-party-button';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { PartyStatus } from '@/lib/database.types';
import { getReleaseLabel } from '@/lib/pricing';

interface PartyPageProps {
  params: Promise<{ id: string }>;
}

export default async function PartyPage({ params }: PartyPageProps) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: party } = await supabase
    .from('listening_parties')
    .select(
      `id, scheduled_at, status, duration_seconds,
       release:releases!listening_parties_release_id_fkey(
         title,
         slug,
         cover_url,
         price_minimum,
         tracks(count),
         artist:profiles!releases_artist_id_fkey(display_name, slug, avatar_url)
       ),
       room:rooms(name, slug, kind)`,
    )
    .eq('id', id)
    .single();

  if (!party) notFound();

  const partyShape = party as unknown as {
    id: string;
    scheduled_at: string;
    status: PartyStatus;
    duration_seconds: number;
    release: {
      title: string;
      slug: string;
      cover_url: string;
      price_minimum: number;
      tracks: { count: number }[] | null;
      artist: { display_name: string; slug: string | null; avatar_url: string | null } | null;
    } | null;
    room: { name: string; slug: string; kind: string } | null;
  };

  const release = partyShape.release;
  const room = partyShape.room;
  const trackCount = Array.isArray(release?.tracks)
    ? (release.tracks[0]?.count ?? 0)
    : 0;
  const durationMin = Math.round(partyShape.duration_seconds / 60);
  const isGmc = room?.kind === 'global_master';

  // Alert subscription for the viewer (if logged in).
  let viewerId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    viewerId = data.user?.id ?? null;
  } catch {
    viewerId = null;
  }
  let isSubscribed = false;
  let viewerIsAdmin = false;
  if (viewerId) {
    const { data: me } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', viewerId)
      .maybeSingle();
    viewerIsAdmin = Boolean(me?.is_admin);
  }
  if (viewerId && partyShape.status === 'scheduled') {
    const { data: alert } = await supabase
      .from('party_alerts')
      .select('party_id')
      .eq('party_id', partyShape.id)
      .eq('user_id', viewerId)
      .maybeSingle();
    isSubscribed = Boolean(alert);
  }

  return (
    <main className="view-enter mx-auto max-w-3xl space-y-8 px-6 pb-32">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10">
        {release && (
          <Image
            src={release.cover_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="absolute inset-0 object-cover opacity-25 blur-2xl mix-blend-screen"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-transparent to-transparent" />
        <div className="grain" />

        <div className="relative z-10 flex flex-col items-center gap-6 p-8 text-center md:p-12">
          {room && (
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">
              {isGmc ? 'Global Master Channel' : room.name}
            </p>
          )}

          {release ? (
            <Link href={`/r/${release.slug}`} className="block">
              <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-[1.5rem] md:h-40 md:w-40">
                <Image
                  src={release.cover_url}
                  alt={release.title}
                  fill
                  className="object-cover"
                />
              </div>
            </Link>
          ) : null}

          <div className="space-y-2">
            {release ? (
              <>
                <Link href={`/r/${release.slug}`}>
                  <h1 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white md:text-4xl">
                    {release.title}
                  </h1>
                </Link>
                {release.artist && (
                  <Link
                    href={release.artist.slug ? `/artist/${release.artist.slug}` : '#'}
                    className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-300 hover:text-indigo-200"
                  >
                    by {release.artist.display_name}
                  </Link>
                )}
              </>
            ) : (
              <h1 className="text-3xl font-black italic uppercase text-white">Party</h1>
            )}
          </div>

          <LiveStatus
            partyId={partyShape.id}
            scheduledAt={partyShape.scheduled_at}
            initialStatus={partyShape.status}
          />

          <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/60">
            <span>
              {getReleaseLabel(trackCount)}
            </span>
            <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
            <span>{durationMin} min</span>
            {release && (
              <>
                <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
                <span className="text-indigo-400">Min ${release.price_minimum.toFixed(2)}</span>
              </>
            )}
          </div>

          {partyShape.status === 'scheduled' && (
            <WaitButton
              partyId={partyShape.id}
              initialSubscribed={isSubscribed}
              isAuthenticated={viewerId !== null}
              variant="primary"
            />
          )}
          {viewerIsAdmin && partyShape.status === 'scheduled' && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                Admin
              </span>
              <CancelPartyButton partyId={partyShape.id} />
            </div>
          )}
          {release && partyShape.status === 'scheduled' && (
            <Link
              href={`/r/${release.slug}`}
              className="text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white"
            >
              View release →
            </Link>
          )}
        </div>
      </section>

      <GlassPanel className="p-5 text-center">
        <p className="text-[11px] italic text-white/60">
          {partyShape.status === 'scheduled'
            ? "We'll notify every Wait subscriber the moment this party goes live. Real-time synchronized playback launches in Phase 4."
            : partyShape.status === 'live'
              ? 'Synchronized playback launches in Phase 4 — party tracking is live in the background.'
              : partyShape.status === 'ended'
                ? 'This party has ended. The release stays available on its page.'
                : 'This party was cancelled.'}
        </p>
      </GlassPanel>
    </main>
  );
}
