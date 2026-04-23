import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ReleaseCard } from '@/components/catalog/release-card';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { LocalDateTime } from '@/components/ui/local-datetime';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface ReleaseRow {
  id: string;
  title: string;
  slug: string;
  cover_url: string;
  created_at: string;
  artist: { display_name: string; slug: string | null } | null;
  tracks: { count: number }[] | null;
}

interface PartyRow {
  id: string;
  scheduled_at: string;
  release: { title: string; slug: string } | null;
  room: { name: string; slug: string } | null;
  artist: { display_name: string; slug: string | null } | null;
}

export default async function LibraryPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to see your library" />;

  const supabase = await getSupabaseServerClient();

  const { data: followRows } = await supabase
    .from('follows')
    .select('followed_id')
    .eq('follower_id', profile.id);
  const followedIds = (followRows ?? []).map((r) => r.followed_id);

  let releases: ReleaseRow[] = [];
  let parties: PartyRow[] = [];

  if (followedIds.length > 0) {
    const [releasesRes, partiesRes] = await Promise.all([
      supabase
        .from('releases')
        .select(
          'id, title, slug, cover_url, created_at, artist:profiles!releases_artist_id_fkey(display_name, slug), tracks(count)',
        )
        .in('artist_id', followedIds)
        .eq('status', 'published')
        .eq('is_listed', true)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('listening_parties')
        .select(
          `id, scheduled_at,
           release:releases!listening_parties_release_id_fkey(title, slug),
           room:rooms(name, slug),
           artist:profiles!listening_parties_artist_id_fkey(display_name, slug)`,
        )
        .in('artist_id', followedIds)
        .in('status', ['scheduled', 'live'])
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(6),
    ]);

    releases = (releasesRes.data ?? []) as unknown as ReleaseRow[];
    parties = (partiesRes.data ?? []) as unknown as PartyRow[];
  }

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-10 px-6 pb-32">
      <div>
        <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
          Library
        </h2>
        <p className="mt-2 text-xs text-white/60">
          Releases and parties from the artists you follow.
        </p>
      </div>

      {followedIds.length === 0 ? (
        <GlassPanel className="space-y-3 p-8 text-center">
          <p className="text-sm italic text-white/70">
            You&apos;re not following anyone yet.
          </p>
          <p className="text-xs italic text-white/50">
            Discover artists on{' '}
            <Link href="/explore/home" className="text-indigo-400 hover:text-indigo-300">
              Explore
            </Link>{' '}
            and tap Follow on their profile.
          </p>
        </GlassPanel>
      ) : (
        <>
          <section>
            <SectionHeader
              title="Upcoming parties"
              count={parties.length}
              empty="No upcoming parties from the people you follow."
            />
            {parties.length > 0 && (
              <div className="space-y-3">
                {parties.map((p) => (
                  <GlassPanel key={p.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold italic text-white">
                        {p.release?.title ?? 'Release'}
                      </p>
                      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/60">
                        {p.artist?.display_name ?? 'Artist'}
                        {p.room && ` · ${p.room.name}`}
                      </p>
                      <p className="mt-1 text-[10px] text-white/50">
                        <LocalDateTime iso={p.scheduled_at} />
                      </p>
                    </div>
                    <Link
                      href={`/party/${p.id}`}
                      className="shrink-0 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-indigo-300 hover:bg-indigo-500/20"
                    >
                      Enter
                    </Link>
                  </GlassPanel>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="New releases"
              count={releases.length}
              empty="No published releases from the people you follow yet."
            />
            {releases.length > 0 && (
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
            )}
          </section>
        </>
      )}
    </main>
  );
}

function SectionHeader({
  title,
  count,
  empty,
}: {
  title: string;
  count: number;
  empty: string;
}) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between text-white/80">
        <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">{title}</h3>
        <span className="font-mono text-[10px] text-white/40">{count}</span>
      </div>
      {count === 0 && <p className="mb-2 text-xs italic text-white/50">{empty}</p>}
    </>
  );
}
