'use client';

import { cn } from '@/lib/cn';

export type Mode = 'explore' | 'artist';

export interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Mode"
      className="glass-panel relative flex h-10 w-40 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 p-1"
    >
      <div
        className={cn(
          'absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full transition-all duration-500',
          mode === 'explore' ? 'bg-white' : 'bg-indigo-600',
        )}
        style={{ transform: mode === 'artist' ? 'translateX(100%)' : 'translateX(0)' }}
        aria-hidden="true"
      />
      <button
        type="button"
        aria-pressed={mode === 'explore'}
        onClick={() => onChange('explore')}
        className={cn(
          'relative z-10 flex h-full flex-1 items-center justify-center text-[9px] font-black tracking-widest uppercase transition-colors duration-300',
          mode === 'explore' ? 'text-black' : 'text-white/60 hover:text-white/80',
        )}
      >
        Explore
      </button>
      <button
        type="button"
        aria-pressed={mode === 'artist'}
        onClick={() => onChange('artist')}
        className={cn(
          'relative z-10 flex h-full flex-1 items-center justify-center text-[9px] font-black tracking-widest uppercase transition-colors duration-300',
          mode === 'artist' ? 'text-white' : 'text-white/60 hover:text-white/80',
        )}
      >
        Artist
      </button>
    </div>
  );
}
