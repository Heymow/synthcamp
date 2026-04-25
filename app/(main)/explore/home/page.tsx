import Link from 'next/link';
import { HeroRelease } from '@/components/catalog/hero-release';
import { ReleaseCard } from '@/components/catalog/release-card';
import { GlassPanel } from '@/components/ui/glass-panel';
import { RoomHeroCard } from '@/components/rooms/room-hero-card';
import { RoomCompactCard } from '@/components/rooms/room-compact-card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface ReleaseWithArtist {
  id: string;
  title: string;
  slug: string;
  cover_url: string;
  description: string | null;
  artist: { display_name: string } | null;
  tracks: { count: number }[] | null;
}

type PartyRow = {
  id: string;
  scheduled_at: string;
  status: 'scheduled' | 'live';
  room_id: string;
  artist_id: string;
  release: {
    title: string;
    slug: string;
    cover_url: string;
    artist: { display_name: string } | null;
  } | null;
};

interface SocialSignal {
  viewerFollowsArtist: boolean;
  followedWaitingCount: number;
}

function socialWeight(s: SocialSignal): number {
  return (s.viewerFollowsArtist ? 10 : 0) + s.followedWaitingCount * 3;
}

export default async function ExploreHomePage() {
  const supabase = await getSupabaseServerClient();

  // Query 1 — Editor's Choice via RPC
  const { data: choiceRows } = await supabase.rpc('get_editors_choice');
  const choice = choiceRows?.[0];
  const isFallback = choice?.is_fallback ?? true;

  let hero: ReleaseWithArtist | null = null;
  if (choice?.release_id) {
    const { data } = await supabase
      .from('releases')
      .select(
        'id, title, slug, cover_url, description, artist:profiles!releases_artist_id_fkey(display_name), tracks(count)',
      )
      .eq('id', choice.release_id)
      .single();
    hero = data as ReleaseWithArtist | null;
  }

  // Query 2 — 6 latest published releases
  const { data: releasesRaw } = await supabase
    .from('releases')
    .select(
      'id, title, slug, cover_url, description, artist:profiles!releases_artist_id_fkey(display_name), tracks(count)',
    )
    .eq('status', 'published')
    .eq('is_listed', true)
    .order('created_at', { ascending: false })
    .limit(6);
  const releases = (releasesRaw ?? []) as unknown as ReleaseWithArtist[];

  // Query 3 — the 3 rooms
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, slug, name, kind, display_order')
    .order('display_order', { ascending: true });

  // Query 4 — upcoming/live parties with minimal release info
  const { data: partiesRaw } = await supabase
    .from('listening_parties')
    .select(
      `id, scheduled_at, status, room_id, artist_id,
       release:releases!listening_parties_release_id_fkey(
         title, slug, cover_url,
         artist:profiles!releases_artist_id_fkey(display_name)
       )`,
    )
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  // Group parties by room_id, keep earliest per room
  const partiesByRoom = new Map<string, PartyRow>();
  for (const p of (partiesRaw ?? []) as unknown as PartyRow[]) {
    if (!partiesByRoom.has(p.room_id)) partiesByRoom.set(p.room_id, p);
  }

  // Does the viewer have an active alert for any of the rendered parties?
  let viewerId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    viewerId = data.user?.id ?? null;
  } catch {
    viewerId = null;
  }
  const alertedPartyIds = new Set<string>();
  const followedIds = new Set<string>();
  const signals = new Map<string, SocialSignal>();
  if (viewerId && partiesByRoom.size > 0) {
    const partyIds = [...partiesByRoom.values()].map((p) => p.id);

    const [alertsRes, followsRes] = await Promise.all([
      // Defensive cap: at the home page's worst case (3 secondary rooms ×
      // a few hundred subs each) 2000 rows is plenty of headroom. Beyond
      // that we accept partial social signal rather than running megabyte
      // queries on every home-page render.
      supabase
        .from('party_alerts')
        .select('party_id, user_id')
        .in('party_id', partyIds)
        .order('user_id', { ascending: true })
        .limit(2000),
      supabase.from('follows').select('followed_id').eq('follower_id', viewerId),
    ]);

    const ownAlerts = (alertsRes.data ?? []).filter((a) => a.user_id === viewerId);
    for (const a of ownAlerts) alertedPartyIds.add(a.party_id);
    for (const f of followsRes.data ?? []) followedIds.add(f.followed_id);

    // Compute per-party social signal.
    for (const party of partiesByRoom.values()) {
      const viewerFollowsArtist = followedIds.has(party.artist_id);
      let followedWaitingCount = 0;
      for (const a of alertsRes.data ?? []) {
        if (a.party_id === party.id && a.user_id !== viewerId && followedIds.has(a.user_id)) {
          followedWaitingCount += 1;
        }
      }
      signals.set(party.id, { viewerFollowsArtist, followedWaitingCount });
    }
  }
  const viewerIsAuthenticated = viewerId !== null;

  const heroTracksCount = hero?.tracks?.[0]?.count ?? 0;

  const roomList = rooms ?? [];
  const gmc = roomList.find((r) => r.kind === 'global_master');
  const secondariesUnsorted = roomList.filter((r) => r.kind !== 'global_master');
  // GMC stays pinned; secondaries re-order by social weight, with the
  // rooms.display_order column as an explicit tie-breaker so identical
  // weights (most commonly weight=0 for everyone, when the viewer is
  // signed-out or follows nobody in the room artists) produce a stable
  // render order across requests.
  const secondaries = [...secondariesUnsorted].sort((a, b) => {
    const pa = partiesByRoom.get(a.id);
    const pb = partiesByRoom.get(b.id);
    const wa = pa ? socialWeight(signals.get(pa.id) ?? { viewerFollowsArtist: false, followedWaitingCount: 0 }) : 0;
    const wb = pb ? socialWeight(signals.get(pb.id) ?? { viewerFollowsArtist: false, followedWaitingCount: 0 }) : 0;
    return (wb - wa) || (a.display_order - b.display_order);
  });

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-12 px-6 pb-32">
      {hero ? (
        <Link href={`/r/${hero.slug}`} className="block">
          <HeroRelease
            release={{
              id: hero.id,
              title: hero.title,
              slug: hero.slug,
              cover_url: hero.cover_url,
              description: hero.description,
              artist: { display_name: hero.artist?.display_name ?? 'Unknown' },
              tracks_count: heroTracksCount,
            }}
            editorsChoice={!isFallback}
            tagline={isFallback ? 'Fresh release.' : undefined}
          />
        </Link>
      ) : (
        <GlassPanel className="p-12 text-center">
          <p className="text-sm italic text-white/60">
            No releases yet. Be the first to publish!
          </p>
        </GlassPanel>
      )}

      {releases.length > 0 && (
        <section>
          <SectionHeader title="New Releases" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            {releases.map((r) => {
              const count = r.tracks?.[0]?.count ?? 0;
              return (
                <Link key={r.id} href={`/r/${r.slug}`}>
                  <ReleaseCard
                    release={{
                      id: r.id,
                      title: r.title,
                      slug: r.slug,
                      cover_url: r.cover_url,
                      artist: { display_name: r.artist?.display_name ?? 'Unknown' },
                      tracks_count: count,
                    }}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="pb-20">
        <SectionHeader title="Active Sound Rooms" />
        <div className="space-y-6">
          {gmc && (() => {
            const p = partiesByRoom.get(gmc.id) ?? null;
            return (
              <RoomHeroCard
                roomName={gmc.name}
                party={p}
                viewerIsAuthenticated={viewerIsAuthenticated}
                initialSubscribed={p ? alertedPartyIds.has(p.id) : false}
                socialSignal={p ? signals.get(p.id) ?? null : null}
              />
            );
          })()}
          <div className="grid grid-cols-1 gap-4">
            {secondaries.map((room, i) => {
              const p = partiesByRoom.get(room.id) ?? null;
              return (
                <RoomCompactCard
                  key={room.id}
                  roomName={room.name}
                  party={p}
                  viewerIsAuthenticated={viewerIsAuthenticated}
                  initialSubscribed={p ? alertedPartyIds.has(p.id) : false}
                  paletteIndex={i}
                  socialSignal={p ? signals.get(p.id) ?? null : null}
                />
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-6 flex items-center justify-between text-white/80">
      <h3 className="text-[10px] font-black uppercase tracking-[0.4em]">{title}</h3>
      <div className="ml-6 h-[1px] flex-1 bg-white/20" />
    </div>
  );
}
