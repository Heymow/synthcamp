import Image from 'next/image';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import type { SoundRoom } from '@/lib/mock-data';

export interface SoundRoomCompactProps {
  room: SoundRoom;
}

export function SoundRoomCompact({ room }: SoundRoomCompactProps) {
  return (
    <article className="glass-panel group relative flex min-h-[95px] cursor-pointer flex-col justify-center overflow-hidden rounded-[1.5rem] border-white/5 p-3 transition-colors hover:bg-white/[0.05] md:rounded-[2rem] md:p-4">
      <StatusTimer baseTime={room.baseTime} isCountdown={room.isCountdown} small />
      <div className="relative z-10 mt-2 flex w-full items-center justify-between gap-3 md:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 md:h-14 md:w-14">
            <Image src={room.cover} alt="" fill className="object-cover opacity-20" />
            {!room.isCountdown ? (
              <LiveVisualizer />
            ) : (
              <DollarSign size={18} strokeWidth={2} className="text-white/80" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
              <h4 className="truncate text-base leading-none font-bold text-white italic md:text-lg">
                {room.title}
              </h4>
              <p className="truncate text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
                by {room.artist}
              </p>
            </div>
            <div className="mt-1 flex items-center gap-2 md:mt-2 md:gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-bold tracking-[0.1em] text-white/70 uppercase">
                <span className="whitespace-nowrap text-white">
                  {room.listeners} {room.isCountdown ? 'waiting' : 'listeners'}
                </span>
                <span className="hidden h-0.5 w-0.5 rounded-full bg-white/30 md:block" />
                <span className="truncate italic" title={room.countries}>
                  {room.countries}
                </span>
              </div>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0">
          {room.isCountdown ? 'Wait' : 'Enter'}
        </Button>
      </div>
    </article>
  );
}
