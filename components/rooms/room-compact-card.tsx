import Image from 'next/image';
import Link from 'next/link';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import { Button } from '@/components/ui/button';

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
}

export function RoomCompactCard({ roomName, party }: RoomCompactCardProps) {
  const release = party?.release ?? null;
  const artistName = release?.artist?.display_name ?? 'Unknown';
  const baseTime = party ? new Date(party.scheduled_at).getTime() : 0;
  const isCountdown = party?.status === 'scheduled';

  const body = (
    <article
      className={
        'glass-panel group relative flex items-center gap-3 overflow-hidden rounded-[1.5rem] border-white/5 p-3 transition-colors md:gap-5 md:rounded-[2rem] md:p-4 ' +
        (party ? 'cursor-pointer hover:bg-white/[0.05]' : 'opacity-70')
      }
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 md:h-14 md:w-14">
        {release && (
          <Image src={release.cover_url} alt="" fill className="object-cover opacity-20" />
        )}
        <LiveVisualizer />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="min-w-0 truncate text-base leading-none font-bold text-white italic md:text-lg">
            {release?.title ?? roomName}
          </h4>
          {party && (
            <StatusTimer baseTime={baseTime} isCountdown={isCountdown} small inline />
          )}
        </div>

        {release ? (
          <p className="truncate text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
            by {artistName}
          </p>
        ) : (
          <p className="truncate text-[10px] font-bold tracking-widest text-white/40 uppercase">
            {roomName}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="truncate text-[9px] italic text-white/60">
            {party?.status === 'live'
              ? 'On air now'
              : party
                ? 'Scheduled'
                : 'No party scheduled'}
          </p>
          {party && (
            <Button variant="ghost" size="sm" className="shrink-0">
              {party.status === 'live' ? 'Enter' : 'View'}
            </Button>
          )}
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
