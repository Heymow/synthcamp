import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { getCurrentProfile } from '@/lib/data/profile';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface PartyRow {
  id: string;
  scheduled_at: string;
  status: string;
  duration_seconds: number;
  release: { title: string; slug: string } | null;
  room: { name: string; slug: string } | null;
}

export default async function ArtistPartiesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/auth/login');
  if (!profile.is_artist) redirect('/settings/profile');

  const supabase = await getSupabaseServerClient();
  const { data: partiesRaw } = await supabase
    .from('listening_parties')
    .select(
      `id, scheduled_at, status, duration_seconds,
       release:releases!listening_parties_release_id_fkey(title, slug),
       room:rooms(name, slug)`,
    )
    .eq('artist_id', profile.id)
    .order('scheduled_at', { ascending: false });

  const parties = (partiesRaw ?? []) as unknown as PartyRow[];

  return (
    <main className="view-enter mx-auto max-w-md space-y-6 px-6 pb-32">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl leading-none font-black tracking-tighter text-white uppercase italic">
          My Parties
        </h2>
        <Link href="/artist/upload">
          <Button variant="primary" size="sm">
            + New Party
          </Button>
        </Link>
      </div>

      {parties.length > 0 ? (
        <div className="space-y-4">
          {parties.map((p) => (
            <GlassPanel key={p.id} className="space-y-2 p-4">
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
                  className={
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-widest uppercase ' +
                    (p.status === 'live'
                      ? 'bg-red-500/20 text-red-300'
                      : p.status === 'scheduled'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : p.status === 'ended'
                          ? 'bg-white/10 text-white/60'
                          : 'bg-white/5 text-white/40')
                  }
                >
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-white/70">
                {p.room?.name ?? 'Unknown room'} ·{' '}
                {new Date(p.scheduled_at).toLocaleString('en-US', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </p>
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/party/${p.id}`}
                  className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase hover:text-indigo-300"
                >
                  View party →
                </Link>
              </div>
            </GlassPanel>
          ))}
        </div>
      ) : (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm text-white/60 italic">
            No parties scheduled.{' '}
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
