import Image from 'next/image';
import Link from 'next/link';
import { Hourglass } from 'lucide-react';
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
  /** Decorative variant (0 or 1) to give each secondary a distinct palette. */
  paletteIndex?: number;
}

const PLACEHOLDER_LISTENERS = {
  live: { count: '840', label: 'listeners' },
  scheduled: { count: '42', label: 'waiting' },
};

const PLACEHOLDER_CITY_SETS = [
  'France, UK, Germany',
  'Japan, USA, Canada',
] as const;

const AVATAR_SEEDS: Array<readonly number[]> = [
  [21, 22, 23],
  [31, 32, 33],
];

export function RoomCompactCard({
  roomName,
  party,
  viewerIsAuthenticated,
  initialSubscribed,
  paletteIndex = 0,
}: RoomCompactCardProps) {
  const release = party?.release ?? null;
  const artistName = release?.artist?.display_name ?? 'Unknown';
  const baseTime = party ? new Date(party.scheduled_at).getTime() : 0;
  const isCountdown = party?.status === 'scheduled';
  const listeners = party ? PLACEHOLDER_LISTENERS[party.status] : null;
  const cities = PLACEHOLDER_CITY_SETS[paletteIndex % PLACEHOLDER_CITY_SETS.length]!;
  const avatars = AVATAR_SEEDS[paletteIndex % AVATAR_SEEDS.length]!;

  const body = (
    <article
      className={
        'glass-panel group relative overflow-hidden rounded-[1.5rem] border-white/5 p-4 transition-colors md:rounded-[2rem] md:p-5 ' +
        (party ? 'cursor-pointer hover:bg-white/[0.05]' : 'opacity-70')
      }
    >
      {party && <StatusTimer baseTime={baseTime} isCountdown={isCountdown} small />}

      <div className="flex items-start gap-3 md:items-center md:gap-5">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 md:h-14 md:w-14">
          {release && (
            <Image src={release.cover_url} alt="" fill className="object-cover opacity-20" />
          )}
          <div className="relative z-10">
            {party?.status === 'live' ? (
              <LiveVisualizer />
            ) : (
              <Hourglass size={16} strokeWidth={2} className="text-white/70" />
            )}
          </div>
        </div>

        <div className="relative z-10 min-w-0 flex-1 space-y-1 pr-16 md:pr-32">
          {/* Title stacks above byline on mobile so line-clamp has the full
              width; goes back to one baseline row on md+. */}
          <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
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

          {listeners ? (
            <div className="space-y-1 pt-2">
              <div className="flex items-center gap-2 text-[9px] font-bold tracking-[0.1em] text-white/70 uppercase">
                <div className="flex -space-x-1.5">
                  {avatars.map((id) => (
                    <Image
                      key={id}
                      src={`https://i.pravatar.cc/80?u=${id}`}
                      alt=""
                      width={18}
                      height={18}
                      className="rounded-full border border-black/40"
                    />
                  ))}
                  <div className="flex h-[18px] min-w-[22px] items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-500/30 px-1 text-[7px] font-bold text-white backdrop-blur-md">
                    +{listeners.count}
                  </div>
                </div>
                <span className="whitespace-nowrap text-white">{listeners.label}</span>
              </div>
              <span className="block truncate text-[8px] font-bold italic uppercase tracking-[0.1em] text-white/60">
                {cities}
              </span>
            </div>
          ) : (
            <p className="truncate pt-2 text-[9px] italic text-white/50">No party scheduled</p>
          )}
        </div>
      </div>

      {/* Mobile: button in-flow below content. Desktop: floated bottom-right
          clear of both timer and content. */}
      {party && (
        <div className="mt-3 flex justify-end md:absolute md:right-5 md:bottom-5 md:mt-0">
          {party.status === 'live' ? (
            <Button variant="ghost" size="sm" className="w-full md:w-auto">
              Enter
            </Button>
          ) : (
            <WaitButton
              partyId={party.id}
              initialSubscribed={initialSubscribed}
              isAuthenticated={viewerIsAuthenticated}
              variant="ghost"
              className="w-full md:w-auto"
            />
          )}
        </div>
      )}
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
