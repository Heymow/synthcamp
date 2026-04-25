import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { CancelPartyButton } from '@/components/party/cancel-party-button';
import { LocalDateTime } from '@/components/ui/local-datetime';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { cn } from '@/lib/cn';

interface PartyRow {
  id: string;
  scheduled_at: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  duration_seconds: number;
  release: { title: string; slug: string } | null;
  room: { name: string; slug: string } | null;
}

interface ArtistPartiesPageProps {
  searchParams: Promise<{ show?: string }>;
}

export default async function ArtistPartiesPage({ searchParams }: ArtistPartiesPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) return <SignInGate subheading="Sign in to manage your parties" />;
  if (!profile.is_artist) redirect('/settings/profile');

  const { show } = await searchParams;
  const showCancelled = show === 'cancelled';

  const supabase = await getSupabaseServerClient();
  const { data: partiesRaw } = await supabase
    .from('listening_parties')
    .select(
      `id, scheduled_at, status, duration_seconds,
       release:releases!listening_parties_release_id_fkey(title, slug),
       room:rooms(name, slug)`,
    )
    .eq('artist_id', profile.id);

  const all = (partiesRaw ?? []) as unknown as PartyRow[];

  const upcoming = all
    .filter((p) => p.status === 'scheduled' || p.status === 'live')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = all
    .filter((p) => p.status === 'ended')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
  const cancelled = all
    .filter((p) => p.status === 'cancelled')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  return (
    <main className="view-enter mx-auto max-w-md space-y-8 px-6 pb-32">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl leading-none font-black tracking-tighter text-white uppercase italic">
          My Parties
        </h2>
        <Button asChild variant="primary" size="sm">
          <Link href="/artist/upload">+ New Party</Link>
        </Button>
      </div>

      <Section
        title="Upcoming"
        count={upcoming.length}
        emptyLabel="No upcoming parties."
      >
        {upcoming.map((p) => (
          <PartyCard key={p.id} p={p} />
        ))}
      </Section>

      {past.length > 0 && (
        <Section title="Past" count={past.length} emptyLabel="">
          {past.map((p) => (
            <PartyCard key={p.id} p={p} />
          ))}
        </Section>
      )}

      {cancelled.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
              Cancelled <span className="font-mono text-white/40">({cancelled.length})</span>
            </h3>
            <Link
              href={showCancelled ? '/artist/parties' : '/artist/parties?show=cancelled'}
              className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
            >
              {showCancelled ? 'Hide' : 'Show'}
            </Link>
          </div>
          {showCancelled &&
            cancelled.map((p) => <PartyCard key={p.id} p={p} />)}
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && cancelled.length === 0 && (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-white/60 italic">
            No parties yet.{' '}
            <Link href="/artist/upload" className="text-indigo-400 hover:text-indigo-300">
              Create a release with a party
            </Link>
            .
          </p>
        </GlassPanel>
      )}
    </main>
  );
}

function Section({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/70">
          {title} <span className="font-mono text-white/40">({count})</span>
        </h3>
      </div>
      {count === 0 ? (
        emptyLabel ? (
          <p className="text-xs italic text-white/50">{emptyLabel}</p>
        ) : null
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

function PartyCard({ p }: { p: PartyRow }) {
  return (
    <GlassPanel
      className={cn(
        'space-y-2 p-4',
        p.status === 'cancelled' && 'opacity-60',
        p.status === 'ended' && 'opacity-80',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {p.release ? (
          <Link
            href={`/r/${p.release.slug}`}
            className="truncate font-bold text-white hover:text-indigo-400"
          >
            {p.release.title}
          </Link>
        ) : (
          <span className="truncate font-bold text-white">Release deleted</span>
        )}
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase',
            p.status === 'live'
              ? 'bg-red-500/20 text-red-300'
              : p.status === 'scheduled'
                ? 'bg-indigo-500/20 text-indigo-300'
                : p.status === 'ended'
                  ? 'bg-white/10 text-white/60'
                  : 'bg-white/5 text-white/40',
          )}
        >
          {p.status}
        </span>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-white/70">
        <span>{p.room?.name ?? 'Unknown room'} ·</span>
        <LocalDateTime iso={p.scheduled_at} />
      </p>
      <div className="flex items-center justify-between gap-2 pt-1">
        <Link
          href={`/party/${p.id}`}
          className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase hover:text-indigo-300"
        >
          View party →
        </Link>
        {p.status === 'scheduled' && <CancelPartyButton partyId={p.id} />}
      </div>
    </GlassPanel>
  );
}
