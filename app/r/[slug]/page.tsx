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
import { getReleaseLabel } from '@/lib/pricing';
import { getSupabaseServerClient } from '@/lib/supabase/server';

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
  if (!data) return { title: 'Release not found — SynthCamp' };
  const row = data as unknown as {
    title: string;
    description: string | null;
    cover_url: string;
    artist: { display_name: string } | null;
  };
  const artistName = row.artist?.display_name ?? 'SynthCamp';
  const title = `${row.title} — ${artistName}`;
  const description = row.description ?? `Listen to ${row.title} by ${artistName} on SynthCamp.`;
  return {
    title,
    description,
    openGraph: {
      type: 'music.album',
      title,
      description,
      images: [{ url: row.cover_url, width: 800, height: 800, alt: row.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [row.cover_url],
    },
  };
}

export default async function ReleasePage({ params }: ReleasePageProps) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

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
    .in('status', ['published', 'unlisted', 'scheduled'])
    .single();

  if (!release) notFound();

  const r = release as unknown as {
    id: string;
    title: string;
    description: string | null;
    cover_url: string;
    credit_category: string;
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
    listening_parties: Array<{
      id: string;
      scheduled_at: string;
      status: string;
      room: { name: string; slug: string } | null;
    }> | null;
  };

  const party = r.listening_parties?.[0] ?? null;
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
          <span className="inline-block rounded-full bg-indigo-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-400">
            {r.credit_category}
          </span>
          {r.credit_narrative && (
            <p className="text-xs italic text-white/60">« {r.credit_narrative} »</p>
          )}
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">
            {getReleaseLabel(tracks.length)} · Min ${r.price_minimum.toFixed(2)}
          </p>
          {party && party.room && (
            <Link
              href={`/party/${party.id}`}
              className="block rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-indigo-300 hover:bg-indigo-500/20"
            >
              Listening Party on {party.room.name} · {new Date(party.scheduled_at).toLocaleString('en-US')}
            </Link>
          )}
          {playerTracks[0] && <PlayReleaseButton track={playerTracks[0]} />}
          <Button variant="ghost" size="md" disabled className="w-full">
            Buy (Phase 3)
          </Button>
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
