import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { AdminNav } from '@/components/admin/admin-nav';
import { LocalDateTime } from '@/components/ui/local-datetime';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { formatCount } from '@/lib/format';

export default async function AdminDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to access admin" />;
  if (!profile.is_admin) notFound();

  const supabase = await getSupabaseServerClient();
  const headCount = (q: Awaited<ReturnType<typeof supabase.from>>) => q;

  const [
    { count: profilesCount },
    { count: artistsCount },
    { count: releasesCount },
    { count: publishedCount },
    { count: scheduledCount },
    { count: draftCount },
    { count: tracksCount },
    { count: partiesCount },
    { count: upcomingPartiesCount },
    { count: livePartiesCount },
    { count: followsCount },
    { count: notificationsCount },
    { count: openReportsCount },
    { count: alertsCount },
    playsResult,
    recentReleasesResult,
    recentUsersResult,
    recentReportsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_artist', true),
    supabase.from('releases').select('*', { count: 'exact', head: true }),
    supabase.from('releases').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('releases').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    supabase.from('releases').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('tracks').select('*', { count: 'exact', head: true }),
    supabase.from('listening_parties').select('*', { count: 'exact', head: true }),
    supabase
      .from('listening_parties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    supabase
      .from('listening_parties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live'),
    supabase.from('follows').select('*', { count: 'exact', head: true }),
    supabase.from('notifications').select('*', { count: 'exact', head: true }),
    supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase.from('party_alerts').select('*', { count: 'exact', head: true }),
    supabase.from('tracks').select('plays_count').limit(10_000),
    supabase
      .from('releases')
      .select(
        'id, title, slug, status, created_at, artist:profiles!releases_artist_id_fkey(display_name, slug)',
      )
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('profiles')
      .select('id, display_name, slug, created_at, is_artist')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('reports')
      .select('id, target_type, reason, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const totalPlays = (playsResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.plays_count ?? 0),
    0,
  );
  // headCount helper is unused but kept for readability of the intent.
  void headCount;

  const recentReleases =
    (recentReleasesResult.data as unknown as Array<{
      id: string;
      title: string;
      slug: string;
      status: string;
      created_at: string;
      artist: { display_name: string; slug: string | null } | null;
    }> | null) ?? [];
  const recentUsers = recentUsersResult.data ?? [];
  const recentReports = recentReportsResult.data ?? [];

  return (
    <main className="view-enter mx-auto max-w-4xl space-y-8 px-6 pb-32">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
            Admin
          </h2>
          <p className="mt-2 text-xs italic text-white/60">
            Read-only overview of platform activity. Deep dives in each tab.
          </p>
        </div>
      </div>

      <AdminNav />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <Stat label="Users" value={profilesCount ?? 0} hint={`${artistsCount ?? 0} artists`} />
        <Stat
          label="Releases"
          value={releasesCount ?? 0}
          hint={`${publishedCount ?? 0} live · ${scheduledCount ?? 0} scheduled · ${draftCount ?? 0} draft`}
        />
        <Stat label="Tracks" value={tracksCount ?? 0} />
        <Stat label="Plays" value={totalPlays} hint="across all tracks" />
        <Stat
          label="Parties"
          value={partiesCount ?? 0}
          hint={`${upcomingPartiesCount ?? 0} upcoming · ${livePartiesCount ?? 0} live`}
        />
        <Stat label="Follows" value={followsCount ?? 0} />
        <Stat label="Party alerts" value={alertsCount ?? 0} />
        <Stat label="Notifications" value={notificationsCount ?? 0} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <GlassPanel className="space-y-3 p-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
            Recent releases
          </h3>
          {recentReleases.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {recentReleases.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link href={`/r/${r.slug}`} className="truncate text-white hover:text-indigo-300">
                    {r.title}
                  </Link>
                  <span className="shrink-0 text-[10px] uppercase tracking-widest text-white/40">
                    {r.artist?.display_name ?? 'Unknown'} · {r.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-white/50">No releases yet.</p>
          )}
        </GlassPanel>

        <GlassPanel className="space-y-3 p-5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
            Recent users
          </h3>
          {recentUsers.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {recentUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2">
                  {u.slug ? (
                    <Link
                      href={`/artist/${u.slug}`}
                      className="truncate text-white hover:text-indigo-300"
                    >
                      {u.display_name}
                    </Link>
                  ) : (
                    <span className="truncate text-white">{u.display_name}</span>
                  )}
                  <span className="shrink-0 text-[10px] uppercase tracking-widest text-white/40">
                    {u.is_artist ? 'artist' : 'listener'} ·{' '}
                    <LocalDateTime
                      iso={u.created_at}
                      showTimezone={false}
                      options={{ dateStyle: 'short' }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-white/50">No users yet.</p>
          )}
        </GlassPanel>

        <GlassPanel className="space-y-3 p-5 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">
              Open reports ({openReportsCount ?? 0})
            </h3>
            <Link
              href="/admin/reports"
              className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
            >
              See all →
            </Link>
          </div>
          {recentReports.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {recentReports.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-2">
                  <span className="truncate text-white">
                    <span className="mr-2 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/70">
                      {r.target_type}
                    </span>
                    {r.reason}
                  </span>
                  <span className="shrink-0 text-[10px] italic text-white/40">
                    <LocalDateTime
                      iso={r.created_at}
                      showTimezone={false}
                      options={{ dateStyle: 'short' }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic text-white/50">No open reports.</p>
          )}
        </GlassPanel>
      </section>
    </main>
  );
}

function Stat({
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
      <p className="font-mono text-2xl font-black text-white">{formatCount(value)}</p>
      {hint && (
        <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{hint}</p>
      )}
    </GlassPanel>
  );
}
