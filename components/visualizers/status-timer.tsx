'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export interface StatusTimerProps {
  baseTime: number;
  isCountdown?: boolean;
  small?: boolean;
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

export function StatusTimer({ baseTime, isCountdown = false, small = false }: StatusTimerProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = isCountdown ? baseTime - now : now - baseTime;
      if (isCountdown && diff <= 0) {
        setTime('LIVE');
        return;
      }
      setTime(formatTime(diff));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [baseTime, isCountdown]);

  return (
    <div
      className={cn('pointer-events-none absolute z-20', small ? 'top-2 right-4' : 'top-5 right-5')}
    >
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-white/10 bg-black/60 px-2.5 py-1.5 font-black tracking-[0.15em] text-white/60 uppercase backdrop-blur-md',
          small ? 'text-[7px]' : 'text-[8px]',
        )}
      >
        {isCountdown ? 'Starts in' : 'Started'}
        <span
          className={cn(
            'ml-1.5 font-mono text-indigo-400 tabular-nums',
            small ? 'text-[9px]' : 'text-[11px]',
          )}
        >
          {time}
        </span>
      </span>
    </div>
  );
}
