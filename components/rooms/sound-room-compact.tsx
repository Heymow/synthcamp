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
    <article className="glass-panel group relative flex min-h-[95px] cursor-pointer flex-col justify-center overflow-hidden rounded-[2rem] border-white/5 p-4 transition-colors hover:bg-white/[0.05]">
      <StatusTimer baseTime={room.baseTime} isCountdown={room.isCountdown} small />
      <div className="relative z-10 mt-2 flex w-full items-center justify-between gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
            <Image src={room.cover} alt="" fill className="object-cover opacity-20" />
            {!room.isCountdown ? (
              <LiveVisualizer />
            ) : (
              <DollarSign size={18} strokeWidth={2} className="text-white/80" />
            )}
          </div>
          <div className="min-w-0 flex-1 pr-4">
            <div className="mb-1 flex items-baseline gap-3">
              <h4 className="truncate text-lg leading-none font-bold text-white italic">
                {room.title}
              </h4>
              <p className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
                by {room.artist}
              </p>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold tracking-[0.1em] text-white/70 uppercase">
                <span className="whitespace-nowrap text-white">
                  {room.listeners} {room.isCountdown ? 'waiting' : 'listeners'}
                </span>
                <span className="h-0.5 w-0.5 rounded-full bg-white/30" />
                <span className="italic">{room.countries}</span>
              </div>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 self-end">
          {room.isCountdown ? 'Wait' : 'Enter'}
        </Button>
      </div>
    </article>
  );
}
