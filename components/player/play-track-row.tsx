'use client';

import { Pause, Play } from 'lucide-react';
import { usePlayer, type PlayerTrack } from '@/components/player/mini-player-provider';
import { cn } from '@/lib/cn';

interface PlayTrackRowProps {
  track: PlayerTrack & { trackNumber: number };
}

export function PlayTrackRow({ track }: PlayTrackRowProps) {
  const { current, isPlaying, play, pause, resume } = usePlayer();
  const isCurrent = current?.id === track.id;
  const active = isCurrent && isPlaying;

  const handleClick = () => {
    if (isCurrent) {
      active ? pause() : resume();
    } else {
      play(track);
    }
  };

  const mm = Math.floor(track.durationSeconds / 60);
  const ss = (track.durationSeconds % 60).toString().padStart(2, '0');

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group flex w-full items-center justify-between p-4 text-left transition hover:bg-white/[0.04]',
        isCurrent && 'bg-indigo-500/[0.08]',
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <span
            className={cn(
              'font-mono text-sm transition',
              isCurrent ? 'text-indigo-400' : 'text-white/50',
              'group-hover:opacity-0',
            )}
          >
            {track.trackNumber.toString().padStart(2, '0')}
          </span>
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center opacity-0 transition',
              'group-hover:opacity-100',
              isCurrent && 'opacity-100',
            )}
          >
            {active ? (
              <Pause size={14} className="text-indigo-400" />
            ) : (
              <Play size={14} className={isCurrent ? 'text-indigo-400' : 'text-white'} />
            )}
          </span>
        </span>
        <span
          className={cn(
            'truncate text-sm transition',
            isCurrent ? 'font-bold text-indigo-300' : 'text-white',
          )}
        >
          {track.title}
        </span>
      </div>
      <span className="font-mono text-xs text-white/60">
        {mm}:{ss}
      </span>
    </button>
  );
}
