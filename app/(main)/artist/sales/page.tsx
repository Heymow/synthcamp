import { redirect } from 'next/navigation';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function ArtistDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to see your dashboard" />;
  if (!profile.is_artist) redirect('/settings/profile');

  const supabase = await getSupabaseServerClient();

  const [
    { count: releaseCount },
    { count: publishedCount },
    { count: partyCount },
    { count: upcomingPartyCount },
    { count: followerCount },
  ] = await Promise.all([
    supabase.from('releases').select('*', { count: 'exact', head: true }).eq('artist_id', profile.id),
    supabase
      .from('releases')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', profile.id)
      .eq('status', 'published'),
    supabase
      .from('listening_parties')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', profile.id),
    supabase
      .from('listening_parties')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', profile.id)
      .in('status', ['scheduled', 'live']),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', profile.id),
  ]);

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <div>
        <h2 className="text-4xl font-black italic uppercase leading-none tracking-tighter text-white">
          Dashboard
        </h2>
        <p className="mt-2 text-xs text-white/60">
          {profile.display_name}
          {profile.slug && (
            <>
              {' · '}
              <Link href={`/artist/${profile.slug}`} className="text-indigo-400 hover:text-indigo-300">
                View public profile
              </Link>
            </>
          )}
        </p>
      </div>

      <GlassPanel className="border-indigo-500/20 bg-indigo-500/5 p-8 text-center">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
          Withdrawable Balance
        </p>
        <p className="font-mono text-6xl font-black italic leading-none tracking-tighter text-white">
          $0<span className="text-2xl text-white/70">.00</span>
        </p>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
          Payments launch in Phase 3
        </p>
      </GlassPanel>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Releases" value={releaseCount ?? 0} hint={`${publishedCount ?? 0} live`} />
        <StatCard
          label="Parties"
          value={partyCount ?? 0}
          hint={`${upcomingPartyCount ?? 0} upcoming`}
        />
        <StatCard label="Followers" value={followerCount ?? 0} />
        <StatCard label="Sales" value={0} hint="Phase 3" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <GlassPanel className="space-y-3 p-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
            Next up
          </h3>
          <div className="space-y-2 text-sm text-white/80">
            <Link href="/artist/catalog" className="block hover:text-indigo-300">
              → Manage your releases
            </Link>
            <Link href="/artist/upload" className="block hover:text-indigo-300">
              → Publish a new release
            </Link>
            <Link href="/artist/parties" className="block hover:text-indigo-300">
              → Review your parties
            </Link>
          </div>
        </GlassPanel>

        <GlassPanel className="space-y-3 p-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
            Recent sales
          </h3>
          <p className="text-sm italic text-white/60">
            No sales yet — payments and purchase history ship in Phase 3.
          </p>
        </GlassPanel>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <GlassPanel className="space-y-1 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/50">{label}</p>
      <p className="font-mono text-3xl font-black text-white">{value}</p>
      {hint && <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{hint}</p>}
    </GlassPanel>
  );
}
