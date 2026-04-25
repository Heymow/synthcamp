import Image from 'next/image';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ReleaseCard } from '@/components/catalog/release-card';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { cn } from '@/lib/cn';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; g?: string; sort?: string }>;
}

interface ReleaseRow {
  id: string;
  title: string;
  slug: string;
  cover_url: string;
  created_at: string;
  artist: { display_name: string } | null;
  tracks: { count: number }[] | null;
}

// Escape PostgREST .or() meta-characters. Raw commas / parens / asterisks /
// backslashes in user input would be parsed as additional filters or
// wildcards against neighbouring columns (and enable filter injection into
// the OR group), so strip them before interpolation.
function sanitizePostgrestTerm(input: string): string {
  return input.replace(/[,()*\\]/g, ' ').trim();
}

// Escape SQL LIKE wildcards so `%` and `_` typed by the user are treated
// literally instead of matching "anything" / "any single char".
function escapeLikeWildcards(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

interface ArtistRow {
  id: string;
  display_name: string;
  slug: string;
  avatar_url: string | null;
  bio: string | null;
}

type SortMode = 'newest' | 'title';

const SORTS: { value: SortMode; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'title', label: 'A → Z' },
];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, g, sort } = await searchParams;
  const query = (q ?? '').trim();
  const selectedGenres = (g ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const sortMode: SortMode = sort === 'title' ? 'title' : 'newest';

  const supabase = await getSupabaseServerClient();

  const { data: genreRows } = await supabase.rpc('popular_genres', { p_limit: 15 });
  const genres = (genreRows ?? []) as Array<{ genre: string; c: number }>;

  let releases: ReleaseRow[] = [];
  let artists: ArtistRow[] = [];

  const hasFilter = query.length > 0 || selectedGenres.length > 0;
  if (hasFilter) {
    // Escape LIKE wildcards so `%` and `_` in user input don't expand
    // matches, and strip PostgREST meta-characters before any interpolation.
    const safeQuery = sanitizePostgrestTerm(query);
    const likeSafe = escapeLikeWildcards(safeQuery);

    let rq = supabase
      .from('releases')
      .select(
        'id, title, slug, cover_url, created_at, artist:profiles!releases_artist_id_fkey(display_name), tracks(count)',
      )
      .in('status', ['published', 'unlisted', 'scheduled'])
      .eq('is_listed', true);

    if (safeQuery.length > 0) rq = rq.ilike('title', `%${likeSafe}%`);
    if (selectedGenres.length > 0) rq = rq.overlaps('genres', selectedGenres);
    rq =
      sortMode === 'title'
        ? rq.order('title', { ascending: true })
        : rq.order('created_at', { ascending: false });

    const { data: releaseRows } = await rq.limit(24);
    // RLS hides banned artists' profile rows, so an orphan join row with
    // artist: null means the owning artist is banned. Drop those so search
    // results don't surface banned-artist content.
    releases = ((releaseRows ?? []) as unknown as ReleaseRow[]).filter(
      (r) => r.artist !== null,
    );

    if (safeQuery.length > 0) {
      // Split the previous .or() into two ilike queries and merge in JS.
      // This avoids the PostgREST .or() filter parser entirely, so even if
      // a future refactor drops sanitizePostgrestTerm we can't inject more
      // filter clauses through commas/parens in the input.
      const pattern = `%${likeSafe}%`;
      const [{ data: byName }, { data: bySlug }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, slug, avatar_url, bio')
          .eq('is_artist', true)
          .not('slug', 'is', null)
          .ilike('display_name', pattern)
          .order('display_name', { ascending: true })
          .limit(20),
        supabase
          .from('profiles')
          .select('id, display_name, slug, avatar_url, bio')
          .eq('is_artist', true)
          .not('slug', 'is', null)
          .ilike('slug', pattern)
          .order('display_name', { ascending: true })
          .limit(20),
      ]);
      const seen = new Set<string>();
      const merged: ArtistRow[] = [];
      for (const row of [...(byName ?? []), ...(bySlug ?? [])] as ArtistRow[]) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        merged.push(row);
      }
      merged.sort((a, b) => a.display_name.localeCompare(b.display_name));
      artists = merged.slice(0, 20);
    }
  }

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <section className="space-y-4">
        <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
          Search
        </h2>

        <form action="/explore/search" method="GET" role="search" className="space-y-4">
          <input
            type="search"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Search artists, releases…"
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/70">
              Sort
              <select
                name="sort"
                defaultValue={sortMode}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white focus:border-indigo-500 focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#050507]">
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {genres.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Genres
              </p>
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => {
                  const checked = selectedGenres.includes(genre.genre);
                  return (
                    <label
                      key={genre.genre}
                      className={cn(
                        'cursor-pointer rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition',
                        checked
                          ? 'bg-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/50'
                          : 'bg-white/5 text-white/60 hover:bg-white/10',
                      )}
                    >
                      <input
                        type="checkbox"
                        name="g"
                        value={genre.genre}
                        defaultChecked={checked}
                        className="sr-only"
                      />
                      {genre.genre}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="rounded-full bg-white/10 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/20"
          >
            Apply
          </button>
        </form>
      </section>

      {!hasFilter ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm italic text-white/60">Start typing or pick a genre.</p>
        </GlassPanel>
      ) : artists.length === 0 && releases.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-sm italic text-white/60">No results for your filters.</p>
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
                        {a.bio && <p className="truncate text-xs text-white/60">{a.bio}</p>}
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
