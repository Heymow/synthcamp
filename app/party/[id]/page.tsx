import { notFound } from 'next/navigation';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';
import { getSupabaseServerClient } from '@/lib/supabase/server';

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

  // Cast: Supabase's join typing returns nested objects.
  const partyShape = party as unknown as {
    id: string;
    scheduled_at: string;
    status: string;
    release: {
      title: string;
      slug: string;
      artist: { display_name: string; slug: string | null } | null;
    } | null;
    room: { name: string; slug: string; kind: string } | null;
  };

  const release = partyShape.release;
  const room = partyShape.room;

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
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          {partyShape.status === 'scheduled' ? 'Scheduled for' : 'Status: ' + partyShape.status}
        </p>
        <p className="font-mono text-sm text-white">
          {new Date(partyShape.scheduled_at).toLocaleString('fr-FR', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
        </p>
        <p className="mt-4 text-[10px] italic text-white/50">
          Listening parties real-time execution launching Phase 4
        </p>
      </GlassPanel>
    </main>
  );
}
