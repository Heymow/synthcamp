import Image from 'next/image';
import Link from 'next/link';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import { Button } from '@/components/ui/button';

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
}

export function RoomHeroCard({ roomName, party }: RoomHeroCardProps) {
  const release = party?.release ?? null;
  const artistName = release?.artist?.display_name ?? 'Unknown';
  const baseTime = party ? new Date(party.scheduled_at).getTime() : 0;
  const isCountdown = party?.status === 'scheduled';

  const Wrap = party
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={`/party/${party.id}`} className="block">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <div>{children}</div>;

  return (
    <Wrap>
      <article
        className={
          'glass-panel group relative overflow-hidden rounded-[2rem] border-white/10 p-1 transition-transform duration-500 md:rounded-[2.5rem] ' +
          (party ? 'cursor-pointer active:scale-[0.99]' : '')
        }
      >
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-transparent" />
        {release && (
          <Image
            src={release.cover_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 66vw"
            className="z-0 object-cover opacity-40 mix-blend-screen blur-2xl transition-transform duration-1000 group-hover:scale-110"
          />
        )}
        <div className="grain z-0" />

        <div className="relative z-10 flex flex-col gap-3 p-3 pt-3 text-left md:gap-5 md:p-5">
          <div className="flex items-center justify-between gap-3 text-white/70">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-[9px] font-black tracking-[0.3em] text-indigo-400 uppercase md:tracking-[0.4em]">
                {party?.status === 'live' ? 'On Air' : party ? 'Next Up' : 'Idle'}
              </span>
              <div className="hidden h-[1px] w-6 bg-white/30 md:block" />
              <span className="hidden truncate text-[9px] font-bold tracking-widest text-white/80 uppercase md:inline">
                {roomName}
              </span>
            </div>
            {party && <StatusTimer baseTime={baseTime} isCountdown={isCountdown} inline />}
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="flex flex-1 items-center gap-4 md:gap-6">
              <div className="relative shrink-0">
                <div className="live-glow relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 backdrop-blur-md md:h-20 md:w-20">
                  {release && (
                    <Image src={release.cover_url} alt="" fill className="object-cover opacity-40" />
                  )}
                  <div className="relative z-10">
                    <LiveVisualizer />
                  </div>
                </div>
                {party?.status === 'live' && (
                  <div className="absolute top-1 right-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-[#050507] bg-red-500 shadow-[0_0_10px_red]" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-2xl leading-[0.95] font-black tracking-tight text-white uppercase italic drop-shadow-lg md:text-3xl md:leading-none">
                  {release?.title ?? roomName}
                </h3>
                {release && (
                  <p className="text-xs font-bold tracking-[0.2em] text-indigo-300 uppercase md:text-[13px]">
                    by {artistName}
                  </p>
                )}
                <p className="pt-1 text-xs leading-snug font-medium text-white italic md:text-sm">
                  {party?.status === 'live'
                    ? 'Live now on the global master channel.'
                    : party
                      ? 'Next listening party on the global master channel.'
                      : 'No scheduled party — this flagship channel is open for bids.'}
                </p>
              </div>
            </div>
            {party ? (
              <Button variant="primary" size="md" className="w-full shrink-0 md:w-auto">
                {party.status === 'live' ? 'Enter Now' : 'View Party'}
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    </Wrap>
  );
}
