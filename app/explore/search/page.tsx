import Image from 'next/image';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ReleaseCard } from '@/components/catalog/release-card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

interface ReleaseRow {
  id: string;
  title: string;
  slug: string;
  cover_url: string;
  artist: { display_name: string } | null;
  tracks: { count: number }[] | null;
}

interface ArtistRow {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  bio: string | null;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();

  let releases: ReleaseRow[] = [];
  let artists: ArtistRow[] = [];

  if (query.length > 0) {
    const supabase = await getSupabaseServerClient();
    const like = `%${query}%`;

    const { data: releaseRows } = await supabase
      .from('releases')
      .select(
        'id, title, slug, cover_url, artist:profiles!releases_artist_id_fkey(display_name), tracks(count)',
      )
      .in('status', ['published', 'unlisted', 'scheduled'])
      .eq('is_listed', true)
      .ilike('title', like)
      .order('created_at', { ascending: false })
      .limit(20);
    releases = (releaseRows ?? []) as unknown as ReleaseRow[];

    const { data: artistRows } = await supabase
      .from('profiles')
      .select('id, display_name, slug, avatar_url, bio')
      .eq('is_artist', true)
      .not('slug', 'is', null)
      .or(`display_name.ilike.${like},slug.ilike.${like}`)
      .order('display_name', { ascending: true })
      .limit(20);
    artists = (artistRows ?? []) as ArtistRow[];
  }

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-10 px-6 pb-32">
      <section className="space-y-4">
        <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
          Search
        </h2>
        <form action="/explore/search" method="GET" role="search">
          <input
            type="search"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Search artists, releases…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
          />
        </form>
      </section>

      {query.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm italic text-white/60">Start typing to search.</p>
        </GlassPanel>
      ) : artists.length === 0 && releases.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm italic text-white/60">
            No results for <span className="text-white">&quot;{query}&quot;</span>.
          </p>
        </GlassPanel>
      ) : (
        <>
          {artists.length > 0 && (
            <section>
              <SectionHeader title="Artists" count={artists.length} />
              <div className="space-y-3">
                {artists.map((a) => (
                  <Link key={a.id} href={`/artist/${a.slug}`}>
                    <GlassPanel className="flex cursor-pointer items-center gap-4 p-4 transition hover:bg-white/[0.05]">
                      {a.avatar_url ? (
                        <Image
                          src={a.avatar_url}
                          alt={a.display_name}
                          width={48}
                          height={48}
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded-full bg-indigo-500/30" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold italic text-white">
                          {a.display_name}
                        </p>
                        {a.bio && (
                          <p className="truncate text-xs text-white/60">{a.bio}</p>
                        )}
                      </div>
                    </GlassPanel>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {releases.length > 0 && (
            <section>
              <SectionHeader title="Releases" count={releases.length} />
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                {releases.map((r) => (
                  <Link key={r.id} href={`/r/${r.slug}`}>
                    <ReleaseCard
                      release={{
                        id: r.id,
                        title: r.title,
                        slug: r.slug,
                        cover_url: r.cover_url,
                        artist: { display_name: r.artist?.display_name ?? 'Unknown' },
                        tracks_count: r.tracks?.[0]?.count ?? 0,
                      }}
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-5 flex items-center justify-between text-white/80">
      <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">{title}</h3>
      <span className="font-mono text-[10px] text-white/40">{count}</span>
    </div>
  );
}
