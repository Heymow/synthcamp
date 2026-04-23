import { notFound } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';
import { LiveStatus } from '@/components/party/live-status';
import { WaitButton } from '@/components/party/wait-button';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { PartyStatus } from '@/lib/database.types';

interface PartyPageProps {
  params: Promise<{ id: string }>;
}

export default async function PartyPage({ params }: PartyPageProps) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: party } = await supabase
    .from('listening_parties')
    .select(
      `id, scheduled_at, status,
       release:releases!listening_parties_release_id_fkey(
         title,
         slug,
         artist:profiles!releases_artist_id_fkey(display_name, slug)
       ),
       room:rooms(name, slug, kind)`,
    )
    .eq('id', id)
    .single();

  if (!party) notFound();

  const partyShape = party as unknown as {
    id: string;
    scheduled_at: string;
    status: PartyStatus;
    release: {
      title: string;
      slug: string;
      artist: { display_name: string; slug: string | null } | null;
    } | null;
    room: { name: string; slug: string; kind: string } | null;
  };

  const release = partyShape.release;
  const room = partyShape.room;

  // Alert subscription for the viewer (if logged in).
  let viewerId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    viewerId = data.user?.id ?? null;
  } catch {
    viewerId = null;
  }
  let isSubscribed = false;
  if (viewerId && partyShape.status === 'scheduled') {
    const { data: alert } = await supabase
      .from('party_alerts')
      .select('party_id')
      .eq('party_id', partyShape.id)
      .eq('user_id', viewerId)
      .maybeSingle();
    isSubscribed = Boolean(alert);
  }

  return (
    <main className="view-enter mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="flex flex-col items-center space-y-4 p-10 text-center">
        <LogoS size={48} />
        {release ? (
          <>
            <h2 className="text-2xl font-black italic uppercase leading-none text-white">
              {release.title}
            </h2>
            {release.artist && (
              <p className="text-xs font-bold uppercase tracking-widest text-white/60">
                by {release.artist.display_name}
              </p>
            )}
          </>
        ) : (
          <h2 className="text-2xl font-black italic uppercase leading-none text-white">
            Party
          </h2>
        )}
        {room && (
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-400">
            on {room.name}
          </p>
        )}
        <LiveStatus
          partyId={partyShape.id}
          scheduledAt={partyShape.scheduled_at}
          initialStatus={partyShape.status}
        />
        {partyShape.status === 'scheduled' && (
          <WaitButton
            partyId={partyShape.id}
            initialSubscribed={isSubscribed}
            isAuthenticated={viewerId !== null}
            variant="primary"
          />
        )}
        <p className="mt-4 text-[10px] italic text-white/50">
          {partyShape.status === 'scheduled'
            ? 'We\u2019ll notify you when it goes live. Real-time playback launches Phase 4.'
            : 'Listening parties real-time execution launching Phase 4'}
        </p>
      </GlassPanel>
    </main>
  );
}
