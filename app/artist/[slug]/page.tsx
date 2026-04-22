import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { ReleaseCard } from '@/components/catalog/release-card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// TODO: reserve slugs 'catalog', 'upload', 'parties', 'sales' at artist registration
// (these collide with Phase 1 static /artist/* pages and would route to those instead).

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
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
        <div className="space-y-2">
          <h1 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
            {profile.display_name}
          </h1>
          {profile.bio && <p className="text-sm italic text-white/80">{profile.bio}</p>}
        </div>
      </section>

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
            <p className="text-sm italic text-white/60">Aucun release publié pour l&apos;instant.</p>
          </GlassPanel>
        )}
      </section>
    </main>
  );
}
