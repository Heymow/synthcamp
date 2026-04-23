import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ReleaseCard } from '@/components/catalog/release-card';
import { FollowButton } from '@/components/social/follow-button';
import { BanUserButton } from '@/components/admin/ban-user-button';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// TODO: reserve slugs 'catalog', 'upload', 'parties', 'sales' at artist registration
// (these collide with Phase 1 static /artist/* pages and would route to those instead).

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url, is_artist')
    .eq('slug', slug)
    .single();
  if (!data || !data.is_artist) return { title: 'Artist not found — SynthCamp' };
  const title = `${data.display_name} — SynthCamp`;
  const description = data.bio ?? `Discover ${data.display_name}'s releases on SynthCamp.`;
  const images = data.avatar_url
    ? [{ url: data.avatar_url, width: 400, height: 400, alt: data.display_name }]
    : undefined;
  return {
    title,
    description,
    openGraph: { type: 'profile', title, description, images },
    twitter: {
      card: images ? 'summary' : 'summary',
      title,
      description,
      images: data.avatar_url ? [data.avatar_url] : undefined,
    },
  };
}

export default async function ArtistProfilePage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!profile || !profile.is_artist) notFound();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  // Is the viewer an admin? drives the ban/unban button below.
  let viewerIsAdmin = false;
  if (viewer) {
    const { data: me } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', viewer.id)
      .maybeSingle();
    viewerIsAdmin = Boolean(me?.is_admin);
  }

  const { count: followerCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('followed_id', profile.id);

  let isFollowing = false;
  const isSelf = viewer?.id === profile.id;
  if (viewer && !isSelf) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', viewer.id)
      .eq('followed_id', profile.id)
      .maybeSingle();
    isFollowing = Boolean(followRow);
  }

  const { data: releasesRaw } = await supabase
    .from('releases')
    .select('id, title, slug, cover_url, tracks(count)')
    .eq('artist_id', profile.id)
    .in('status', ['published', 'unlisted', 'scheduled'])
    .order('created_at', { ascending: false });

  const releases = (releasesRaw ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    cover_url: string;
    tracks: { count: number }[] | null;
  }>;

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <section className="flex items-center gap-6">
        {profile.avatar_url && (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name}
            width={96}
            height={96}
            className="rounded-full"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
            {profile.display_name}
          </h1>
          {profile.bio && <p className="text-sm italic text-white/80">{profile.bio}</p>}
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            <span className="font-mono text-white">{followerCount ?? 0}</span>{' '}
            {followerCount === 1 ? 'follower' : 'followers'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {!viewer ? (
            <FollowButton
              artistSlug={slug}
              initialFollowing={false}
              disabled
              disabledReason="Sign in to follow"
            />
          ) : isSelf ? null : (
            <FollowButton artistSlug={slug} initialFollowing={isFollowing} />
          )}
          {viewerIsAdmin && !isSelf && (
            <BanUserButton
              userId={profile.id}
              userName={profile.display_name}
              initiallyBanned={Boolean(profile.banned_at)}
              initialReason={profile.banned_reason}
            />
          )}
        </div>
      </section>

      {profile.banned_at && viewerIsAdmin && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
          <p className="font-bold uppercase tracking-widest">User banned</p>
          {profile.banned_reason && (
            <p className="mt-1 italic text-red-100">{profile.banned_reason}</p>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/70">
          Releases
        </h2>
        {releases.length > 0 ? (
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
                      artist: { display_name: profile.display_name },
                      tracks_count: count,
                    }}
                  />
                </Link>
              );
            })}
          </div>
        ) : (
          <GlassPanel className="p-6 text-center">
            <p className="text-sm italic text-white/60">No releases published yet.</p>
          </GlassPanel>
        )}
      </section>
    </main>
  );
}
