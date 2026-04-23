'use client';

import Image from 'next/image';
import { Pause, Play, X } from 'lucide-react';
import { usePlayer } from '@/components/player/mini-player-provider';

function formatClock(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
}

export function MiniPlayer() {
  const { current, isPlaying, positionSeconds, pause, resume, stop } = usePlayer();
  if (!current) return null;

  const progress = Math.min(100, (positionSeconds / current.durationSeconds) * 100);

  return (
    <div
      role="region"
      aria-label="Now playing"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#050507]/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:gap-4 md:px-8">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl md:h-14 md:w-14">
          <Image
            src={current.coverUrl}
            alt={current.title}
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold italic text-white">{current.title}</p>
          <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/60">
            {current.artist}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[9px] text-white/60">
              {formatClock(positionSeconds)}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-[9px] text-white/60">
              {formatClock(current.durationSeconds)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={isPlaying ? pause : resume}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-400 md:h-12 md:w-12"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={stop}
          aria-label="Close"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/5 hover:text-white sm:flex"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
