import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { ArchiveReleaseButton } from '@/components/catalog/archive-release-button';
import { getPrice, getReleaseLabel } from '@/lib/pricing';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function ArtistCatalogPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to see your catalog" />;
  if (!profile.is_artist) redirect('/settings/profile');

  const supabase = await getSupabaseServerClient();
  const { data: releasesRaw } = await supabase
    .from('releases')
    .select('id, title, slug, cover_url, status, tracks(count)')
    .eq('artist_id', profile.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false });

  const releases = (releasesRaw ?? []) as Array<{
    id: string;
    title: string;
    slug: string;
    cover_url: string;
    status: string;
    tracks: { count: number }[] | null;
  }>;

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <div className="flex items-end justify-between text-white/90">
        <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-white">
          My Music
        </h2>
        <Link href="/artist/upload">
          <Button variant="primary" size="sm">
            + New
          </Button>
        </Link>
      </div>
      {releases.length > 0 ? (
        <div className="space-y-4">
          {releases.map((r) => {
            const count = r.tracks?.[0]?.count ?? 0;
            return (
              <GlassPanel
                key={r.id}
                className="flex items-center gap-5 p-4 transition-colors hover:bg-white/[0.05]"
              >
                <Link
                  href={`/r/${r.slug}`}
                  className="flex flex-1 cursor-pointer items-center gap-5 overflow-hidden"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                    <Image src={r.cover_url} alt={r.title} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <h3 className="truncate text-sm font-bold italic text-white">{r.title}</h3>
                    <p className="text-[9px] uppercase tracking-widest text-white/60">
                      {getReleaseLabel(count)} · {r.status}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-indigo-400">
                    ${getPrice(count)}
                  </span>
                </Link>
                <ArchiveReleaseButton releaseId={r.id} releaseTitle={r.title} />
              </GlassPanel>
            );
          })}
        </div>
      ) : (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm italic text-white/60">
            No releases yet.{' '}
            <Link href="/artist/upload" className="text-indigo-400 hover:text-indigo-300">
              Create your first
            </Link>
            .
          </p>
        </GlassPanel>
      )}
    </main>
  );
}
