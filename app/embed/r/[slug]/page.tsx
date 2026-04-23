import { notFound } from 'next/navigation';
import Image from 'next/image';
import { EmbedPlayer } from '@/components/embed/embed-player';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface EmbedPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EmbedReleasePage({ params }: EmbedPageProps) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: release } = await supabase
    .from('releases')
    .select(
      `id, title, cover_url,
       artist:profiles!releases_artist_id_fkey(display_name, slug),
       tracks(id, track_number, title, duration_seconds, preview_url)`,
    )
    .eq('slug', slug)
    .in('status', ['published', 'unlisted', 'scheduled'])
    .single();

  if (!release) notFound();

  const r = release as unknown as {
    id: string;
    title: string;
    cover_url: string;
    artist: { display_name: string; slug: string | null } | null;
    tracks: Array<{
      id: string;
      track_number: number;
      title: string;
      duration_seconds: number;
      preview_url: string | null;
    }>;
  };

  const tracks = [...r.tracks].sort((a, b) => a.track_number - b.track_number);

  return (
    <main className="mx-auto flex min-h-screen max-w-[640px] flex-col gap-3 p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          <Image
            src={r.cover_url}
            alt={r.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold italic leading-tight text-white">
            {r.title}
          </p>
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/60">
            {r.artist?.display_name ?? 'Artist'}
          </p>
          <a
            href={`/r/${slug}`}
            target="_top"
            className="mt-0.5 inline-block text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
          >
            Open in SynthCamp →
          </a>
        </div>
      </div>

      <EmbedPlayer releaseSlug={slug} releaseCover={r.cover_url} tracks={tracks} />
    </main>
  );
}
