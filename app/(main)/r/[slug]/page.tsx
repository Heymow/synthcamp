import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { AutoCue } from '@/components/player/auto-cue';
import { PlayReleaseButton } from '@/components/player/play-release-button';
import { PlayTrackRow } from '@/components/player/play-track-row';
import type { PlayerTrack } from '@/components/player/mini-player-provider';
import { EmbedButton } from '@/components/catalog/embed-button';
import { ReportButton } from '@/components/social/report-button';
import { CancelPartyButton } from '@/components/party/cancel-party-button';
import { ArchiveReleaseButton } from '@/components/catalog/archive-release-button';
import { DeleteDraftButton } from '@/components/catalog/delete-draft-button';
import { CreativeCredits } from '@/components/catalog/creative-credits';
import { LocalDateTime } from '@/components/ui/local-datetime';
import { getReleaseLabel } from '@/lib/pricing';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { CreditCategory, ReleaseStatus } from '@/lib/database.types';

interface ReleasePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ReleasePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('releases')
    .select('title, description, cover_url, artist:profiles!releases_artist_id_fkey(display_name)')
    .eq('slug', slug)
    .in('status', ['published', 'unlisted', 'scheduled'])
    .single();
  if (!data) return { title: 'Release not found · SynthCamp' };
  const row = data as unknown as {
    title: string;
    description: string | null;
    cover_url: string;
    artist: { display_name: string } | null;
  };
  const artistName = row.artist?.display_name ?? 'SynthCamp';
  const title = `${row.title} · ${artistName}`;
  const description = row.description ?? `Listen to ${row.title} by ${artistName} on SynthCamp.`;
  return {
    title,
    description,
    openGraph: {
      type: 'music.album',
      title,
      description,
      // image supplied by app/(main)/r/[slug]/opengraph-image.tsx
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      // image inherits from the opengraph-image above
    },
  };
}

export default async function ReleasePage({ params }: ReleasePageProps) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  // RLS lets the artist see their own draft; relax the status filter so
  // the owner can preview scheduled/draft releases on /r/[slug].
  // auth.getUser can throw on corrupt/expired cookies — swallow so the
  // page renders for anonymous viewers regardless.
  let viewer: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    viewer = data.user;
  } catch {
    viewer = null;
  }

  // Is the viewer an admin? Enables moderation controls below.
  let viewerIsAdmin = false;
  if (viewer) {
    const { data: me } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', viewer.id)
      .maybeSingle();
    viewerIsAdmin = Boolean(me?.is_admin);
  }

  const statuses: ReleaseStatus[] = viewer
    ? ['published', 'unlisted', 'scheduled', 'draft', 'archived']
    : ['published', 'unlisted', 'scheduled'];

  const { data: release } = await supabase
    .from('releases')
    .select(
      `*,
       artist:profiles!releases_artist_id_fkey(display_name, slug, bio),
       tracks(id, track_number, title, duration_seconds, preview_url, plays_count),
       listening_parties(
         id, scheduled_at, status,
         room:rooms(name, slug)
       )`,
    )
    .eq('slug', slug)
    .in('status', statuses)
    .single();

  if (!release) notFound();

  type Party = {
    id: string;
    scheduled_at: string;
    status: string;
    room: { name: string; slug: string } | null;
  };

  const r = release as unknown as {
    id: string;
    title: string;
    description: string | null;
    cover_url: string;
    status: string;
    artist_id: string;
    credit_category: CreditCategory;
    credit_tags: string[] | null;
    credit_narrative: string | null;
    price_minimum: number;
    artist: { display_name: string; slug: string | null; bio: string | null };
    tracks: Array<{
      id: string;
      track_number: number;
      title: string;
      duration_seconds: number;
      preview_url: string | null;
      plays_count: number;
    }>;
    // UNIQUE(release_id) on listening_parties means PostgREST sometimes
    // collapses this to a single object. Normalize below.
    listening_parties: Party[] | Party | null;
  };

  // Owner must also be able to view drafts; non-owners hit 404 on drafts.
  const isOwner = viewer?.id === r.artist_id;
  if (r.status === 'draft' && !isOwner) notFound();

  const rawParties = r.listening_parties;
  const parties: Party[] = Array.isArray(rawParties)
    ? rawParties
    : rawParties
      ? [rawParties]
      : [];
  // Prefer an active party (scheduled/live). Fall back to the most recent
  // cancelled/ended party so the owner still sees history on their draft.
  const party =
    parties.find((p) => p.status === 'scheduled' || p.status === 'live') ?? parties[0] ?? null;
  const tracks = [...r.tracks].sort((a, b) => a.track_number - b.track_number);

  const playerTracks: PlayerTrack[] = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artist: r.artist.display_name,
    coverUrl: r.cover_url,
    durationSeconds: t.duration_seconds,
    previewUrl: t.preview_url,
    releaseSlug: slug,
  }));

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <section className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_1.5fr]">
        <div className="relative aspect-square overflow-hidden rounded-[2rem]">
          <Image src={r.cover_url} alt={r.title} fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" priority />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-white">
            {r.title}
          </h1>
          {r.artist.slug ? (
            <Link
              href={`/artist/${r.artist.slug}`}
              className="text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
            >
              by {r.artist.display_name}
            </Link>
          ) : (
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
              by {r.artist.display_name}
            </p>
          )}
          {r.description && <p className="text-sm italic text-white/80">{r.description}</p>}
          <CreativeCredits
            category={r.credit_category}
            tags={r.credit_tags ?? []}
            narrative={r.credit_narrative}
          />
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            {getReleaseLabel(tracks.length)} · Min ${r.price_minimum.toFixed(2)} ·{' '}
            <span className="text-white/50">{r.status}</span>
          </p>

          {viewerIsAdmin && !isOwner && r.status !== 'archived' && (
            <div className="flex items-center gap-2 pt-1">
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                Admin
              </span>
              <ArchiveReleaseButton releaseId={r.id} releaseTitle={r.title} />
            </div>
          )}
          {party && party.room && (
            <div
              className={
                'space-y-2 rounded-xl border px-4 py-3 ' +
                (party.status === 'live'
                  ? 'border-red-500/40 bg-red-500/10'
                  : party.status === 'scheduled'
                    ? 'border-indigo-500/30 bg-indigo-500/10'
                    : 'border-white/10 bg-white/5')
              }
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/party/${party.id}`}
                  className="text-xs font-bold uppercase tracking-widest text-indigo-300 hover:text-indigo-200"
                >
                  {party.status === 'live' ? 'Live now' : 'Listening Party'} ·{' '}
                  {party.room.name}
                </Link>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/70">
                  {party.status}
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                <LocalDateTime
                  iso={party.scheduled_at}
                  options={{ dateStyle: 'full', timeStyle: 'short' }}
                />
              </p>
              {isOwner && party.status === 'scheduled' && (
                <div className="pt-1">
                  <CancelPartyButton partyId={party.id} />
                </div>
              )}
            </div>
          )}

          {isOwner && r.status === 'draft' && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] italic text-white/60">
                Draft preview. Visible only to you.
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={`/artist/upload?draftId=${r.id}`}
                  className="inline-flex cursor-pointer items-center rounded-lg border border-indigo-300/40 bg-indigo-500/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-100 transition hover:bg-indigo-500/30"
                >
                  Continue draft
                </Link>
                <DeleteDraftButton
                  releaseId={r.id}
                  releaseTitle={r.title}
                  redirectTo="/artist/catalog"
                />
              </div>
            </div>
          )}
          {playerTracks[0] && <PlayReleaseButton track={playerTracks[0]} />}
          <Button variant="ghost" size="md" disabled className="w-full">
            Buy (Phase 3)
          </Button>
          <EmbedButton slug={slug} />
          <div className="pt-2">
            <ReportButton targetType="release" targetId={r.id} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/70">
          Tracklist
        </h2>
        <GlassPanel className="divide-y divide-white/5 p-0">
          {playerTracks.map((pt, i) => (
            <PlayTrackRow
              key={pt.id}
              track={{
                ...pt,
                trackNumber: tracks[i]!.track_number,
                playsCount: tracks[i]!.plays_count,
              }}
            />
          ))}
        </GlassPanel>
      </section>

      <AutoCue tracks={playerTracks} />
    </main>
  );
}
