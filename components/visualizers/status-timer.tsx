'use client';

import { cn } from '@/lib/cn';
import { useNow } from '@/lib/now-context';

export interface StatusTimerProps {
  baseTime: number;
  isCountdown?: boolean;
  small?: boolean;
  /** Render inline as a flex child instead of absolutely positioned in a corner. */
  inline?: boolean;
}

function formatTime(diff: number): string {
  const abs = Math.abs(diff);
  const seconds = Math.floor((abs / 1000) % 60);
  const minutes = Math.floor((abs / (1000 * 60)) % 60);
  const hours = Math.floor((abs / (1000 * 60 * 60)) % 24);

  const parts: string[] = [];
  if (hours > 0) parts.push(hours.toString().padStart(2, '0'));
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(seconds.toString().padStart(2, '0'));
  return parts.join(':');
}

export function StatusTimer({
  baseTime,
  isCountdown = false,
  small = false,
  inline = false,
}: StatusTimerProps) {
  const now = useNow();
  const diff = isCountdown ? baseTime - now : now - baseTime;
  const time = isCountdown && diff <= 0 ? 'LIVE' : formatTime(diff);

  const chip = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border border-white/10 bg-black/60 px-2.5 py-1.5 font-black tracking-[0.15em] text-white/60 uppercase backdrop-blur-md',
        small ? 'text-[7px]' : 'text-[8px]',
      )}
    >
      {isCountdown ? 'Starts in' : 'Started'}
      <span
        className={cn(
          'ml-1.5 font-mono tabular-nums text-indigo-400',
          small ? 'text-[9px]' : 'text-[11px]',
        )}
      >
        {time}
      </span>
    </span>
  );

  if (inline) return chip;

  return (
    <div
      className={cn('pointer-events-none absolute z-20', small ? 'top-2 right-4' : 'top-5 right-5')}
    >
      {chip}
    </div>
  );
}
