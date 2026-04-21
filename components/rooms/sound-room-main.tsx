import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LiveVisualizer } from '@/components/visualizers/live-visualizer';
import { StatusTimer } from '@/components/visualizers/status-timer';
import { MAIN_ROOM, MAIN_ROOM_START } from '@/lib/mock-data';

export function SoundRoomMain() {
  return (
    <article className="glass-panel group relative cursor-pointer overflow-hidden rounded-[2rem] border-white/10 p-1 transition-transform duration-500 active:scale-[0.99] md:rounded-[2.5rem]">
      <StatusTimer baseTime={MAIN_ROOM_START} />
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-900/40 via-transparent to-transparent" />
      <Image
        src={MAIN_ROOM.cover}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 66vw"
        className="z-0 object-cover opacity-40 mix-blend-screen blur-2xl transition-transform duration-1000 group-hover:scale-110"
      />
      <div className="grain z-0" />
      <div className="relative z-10 flex flex-col items-stretch justify-between gap-4 p-4 text-left md:flex-row md:items-center md:gap-6 md:p-5">
        <div className="flex flex-1 items-center gap-4 md:gap-6">
          <div className="relative shrink-0">
            <div className="live-glow relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 backdrop-blur-md md:h-20 md:w-20">
              <Image src={MAIN_ROOM.cover} alt="" fill className="object-cover opacity-40" />
              <div className="relative z-10">
                <LiveVisualizer />
              </div>
            </div>
            <div className="absolute top-1 right-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-[#050507] bg-red-500 shadow-[0_0_10px_red]" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="mb-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-white/70">
              <span className="text-[9px] font-black tracking-[0.3em] text-indigo-400 uppercase md:tracking-[0.4em]">
                On Air
              </span>
              <div className="hidden h-[1px] w-6 bg-white/30 sm:block" />
              <span className="truncate text-[9px] font-bold tracking-widest text-white/80 uppercase">
                {MAIN_ROOM.channel}
              </span>
            </div>
            <h3 className="text-2xl leading-[0.95] font-black tracking-tight text-white uppercase italic drop-shadow-lg md:text-3xl md:leading-none">
              {MAIN_ROOM.title}
            </h3>
            <p className="pt-0.5 text-xs font-bold tracking-[0.2em] text-indigo-300 uppercase md:text-[13px]">
              by {MAIN_ROOM.artist}
            </p>
            <p className="pt-0.5 text-xs leading-snug font-medium text-white italic md:text-sm">
              {MAIN_ROOM.tagline}
            </p>
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-3 text-white/80">
                <div className="flex -space-x-2">
                  {[11, 12, 13, 14].map((id) => (
                    <Image
                      key={id}
                      src={`https://i.pravatar.cc/100?u=${id}`}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full border border-black/40"
                    />
                  ))}
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/20 text-[7px] font-bold backdrop-blur-md">
                    +1.2k
                  </div>
                </div>
                <span className="text-[9px] font-bold tracking-widest text-indigo-300 uppercase">
                  Live Worldwide
                </span>
              </div>
              <span className="block truncate text-[8px] font-bold tracking-[0.1em] text-white/70 uppercase italic drop-shadow-md">
                {MAIN_ROOM.countries}
              </span>
            </div>
          </div>
        </div>
        <Button variant="primary" size="md" className="w-full shrink-0 md:w-auto">
          Enter Now
        </Button>
      </div>
    </article>
  );
}
