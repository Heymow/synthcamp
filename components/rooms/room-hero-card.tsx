import Image from 'next/image';
import Link from 'next/link';
import { Hourglass } from 'lucide-react';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import { Button } from '@/components/ui/button';
import { WaitButton } from '@/components/party/wait-button';

export interface RoomHeroCardParty {
  id: string;
  scheduled_at: string;
  status: 'scheduled' | 'live';
  release: {
    title: string;
    slug: string;
    cover_url: string;
    artist: { display_name: string } | null;
  } | null;
}

export interface RoomHeroCardProps {
  roomName: string;
  party: RoomHeroCardParty | null;
  viewerIsAuthenticated: boolean;
  initialSubscribed: boolean;
}

// Decorative avatar ids; phase 5 swaps these for real followed-listener avatars.
const DECOR_AVATARS = [11, 12, 13, 14] as const;
const PLACEHOLDER_CITIES = 'London, Paris, Tokyo, Berlin, NYC…';

export function RoomHeroCard({
  roomName,
  party,
  viewerIsAuthenticated,
  initialSubscribed,
}: RoomHeroCardProps) {
  const release = party?.release ?? null;
  const artistName = release?.artist?.display_name ?? 'Unknown';
  const baseTime = party ? new Date(party.scheduled_at).getTime() : 0;
  const isCountdown = party?.status === 'scheduled';
  const stateLabel = party?.status === 'live'
    ? 'On Air'
    : party
      ? 'Next Up'
      : 'Flagship';
  const tagline = party?.status === 'live'
    ? 'Experience the master cut with 1.2k listeners'
    : party
      ? 'Next listening party on the global master channel.'
      : 'The flagship channel — premium parties, one per artist per month.';
  const worldLabel = party?.status === 'live'
    ? 'Live Worldwide'
    : party
      ? 'Worldwide Soon'
      : 'Worldwide';

  const content = (
    <article
      className={
        'glass-panel group relative overflow-hidden rounded-[2.5rem] border-white/10 p-1 transition-transform duration-500 ' +
        (party ? 'cursor-pointer active:scale-[0.99]' : '')
      }
    >
      {party && <StatusTimer baseTime={baseTime} isCountdown={isCountdown} />}
      <div className="gmc-backdrop absolute inset-0 z-0" />
      {release && (
        <Image
          src={release.cover_url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 66vw"
          className="z-0 object-cover opacity-25 mix-blend-screen blur-2xl transition-transform duration-1000 group-hover:scale-110"
        />
      )}
      <div className="grain z-0" />

      <div className="relative z-10 flex flex-col items-center justify-between gap-6 p-5 text-left md:flex-row">
        <div className="flex flex-1 items-center gap-6">
          <div className="relative shrink-0">
            <div className="live-glow relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-inner backdrop-blur-md">
              {release && (
                <Image
                  src={release.cover_url}
                  alt=""
                  fill
                  className="absolute inset-0 object-cover opacity-40"
                />
              )}
              <div className="relative z-10">
                {party?.status === 'live' ? (
                  <LiveVisualizer />
                ) : (
                  <Hourglass size={22} strokeWidth={2} className="text-white/80" />
                )}
              </div>
            </div>
            {party?.status === 'live' && (
              <div className="absolute top-1 right-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-[#050507] bg-red-500 shadow-[0_0_10px_red]" />
            )}
          </div>

          <div className="space-y-1">
            <div className="mb-0.5 flex items-center gap-3 text-white/70">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">
                {stateLabel}
              </span>
              <div className="h-[1px] w-6 bg-white/30" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/80">
                {roomName}
              </span>
            </div>
            <h3 className="text-3xl font-black italic uppercase leading-none tracking-tight text-white drop-shadow-lg">
              {release?.title ?? roomName}
            </h3>
            {release && (
              <p className="pt-0.5 text-[13px] font-bold uppercase tracking-[0.2em] text-indigo-300">
                by {artistName}
              </p>
            )}
            <p className="pt-0.5 text-sm font-medium italic text-white">{tagline}</p>
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-3 text-white/80">
                <div className="flex -space-x-2">
                  {DECOR_AVATARS.map((id) => (
                    <Image
                      key={id}
                      src={`https://i.pravatar.cc/100?u=${id}`}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full border border-black/40"
                    />
                  ))}
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/30 text-[7px] font-bold text-white backdrop-blur-md">
                    +1.2k
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-300">
                  {worldLabel}
                </span>
              </div>
              <span className="block text-[8px] font-bold italic uppercase tracking-[0.1em] text-white/60 drop-shadow-md">
                {PLACEHOLDER_CITIES}
              </span>
            </div>
          </div>
        </div>
        {party ? (
          party.status === 'live' ? (
            <Button variant="primary" size="md" className="w-full shrink-0 md:w-auto">
              Enter Now
            </Button>
          ) : (
            <WaitButton
              partyId={party.id}
              initialSubscribed={initialSubscribed}
              isAuthenticated={viewerIsAuthenticated}
              variant="primary"
              className="shrink-0 md:mt-6"
            />
          )
        ) : null}
      </div>
    </article>
  );

  return party ? (
    <Link href={`/party/${party.id}`} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
