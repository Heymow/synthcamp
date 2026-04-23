import Image from 'next/image';
import Link from 'next/link';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import { Button } from '@/components/ui/button';
import { WaitButton } from '@/components/party/wait-button';

export interface RoomCompactCardParty {
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

export interface RoomCompactCardProps {
  roomName: string;
  party: RoomCompactCardParty | null;
  viewerIsAuthenticated: boolean;
  initialSubscribed: boolean;
}

// Placeholder listener data — phase 5 replaces with real counts + regions.
const PLACEHOLDER_LISTENERS = {
  live: { count: '840', label: 'listeners', region: 'Worldwide' },
  scheduled: { count: '42', label: 'waiting', region: 'Worldwide' },
};

export function RoomCompactCard({
  roomName,
  party,
  viewerIsAuthenticated,
  initialSubscribed,
}: RoomCompactCardProps) {
  const release = party?.release ?? null;
  const artistName = release?.artist?.display_name ?? 'Unknown';
  const baseTime = party ? new Date(party.scheduled_at).getTime() : 0;
  const isCountdown = party?.status === 'scheduled';
  const listeners = party ? PLACEHOLDER_LISTENERS[party.status] : null;

  const body = (
    <article
      className={
        'glass-panel group relative flex min-h-[95px] items-center gap-3 overflow-hidden rounded-[1.5rem] border-white/5 p-4 transition-colors md:gap-5 md:rounded-[2rem] md:p-5 ' +
        (party ? 'cursor-pointer hover:bg-white/[0.05]' : 'opacity-70')
      }
    >
      {party && <StatusTimer baseTime={baseTime} isCountdown={isCountdown} small />}
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 md:h-14 md:w-14">
        {release && (
          <Image src={release.cover_url} alt="" fill className="object-cover opacity-20" />
        )}
        <LiveVisualizer />
      </div>

      <div className="relative z-10 min-w-0 flex-1 space-y-1 pr-16">
        <div className="flex items-baseline gap-3">
          <h4 className="line-clamp-2 min-w-0 text-base leading-tight font-bold text-white italic md:text-lg">
            {release?.title ?? roomName}
          </h4>
          {release && (
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
              by {artistName}
            </p>
          )}
        </div>

        {!release && (
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/40">
            {roomName}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {listeners ? (
            <div className="flex min-w-0 items-center gap-2 text-[9px] font-bold tracking-[0.1em] text-white/70 uppercase">
              <span className="whitespace-nowrap text-white">
                {listeners.count} {listeners.label}
              </span>
              <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-white/30" />
              <span className="truncate italic">{listeners.region}</span>
            </div>
          ) : (
            <p className="truncate text-[9px] italic text-white/50">No party scheduled</p>
          )}
          {party &&
            (party.status === 'live' ? (
              <Button variant="ghost" size="sm" className="shrink-0">
                Enter
              </Button>
            ) : (
              <WaitButton
                partyId={party.id}
                initialSubscribed={initialSubscribed}
                isAuthenticated={viewerIsAuthenticated}
                variant="ghost"
                className="shrink-0"
              />
            ))}
        </div>
      </div>
    </article>
  );

  return party ? (
    <Link href={`/party/${party.id}`} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
