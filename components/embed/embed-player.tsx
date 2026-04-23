'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/cn';

interface EmbedTrack {
  id: string;
  track_number: number;
  title: string;
  duration_seconds: number;
  preview_url: string | null;
}

interface EmbedPlayerProps {
  releaseSlug: string;
  releaseCover: string;
  tracks: EmbedTrack[];
}

function clock(total: number): string {
  const mm = Math.floor(total / 60);
  const ss = Math.floor(total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function EmbedPlayer({ tracks }: EmbedPlayerProps) {
  const [activeId, setActiveId] = useState<string | null>(tracks[0]?.id ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countedRef = useRef<string | null>(null);

  const active = tracks.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (active?.preview_url) {
      if (el.src !== active.preview_url) {
        el.src = active.preview_url;
        el.load();
      }
    } else {
      el.removeAttribute('src');
    }
    setPosition(0);
    countedRef.current = null;
  }, [active]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying && active?.preview_url) {
      void el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying, active]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setPosition(el.currentTime);
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, []);

  // Fire the play counter once per track play session, past 10s.
  useEffect(() => {
    if (!active) return;
    if (countedRef.current === active.id) return;
    if (position < 10) return;
    countedRef.current = active.id;
    void fetch(`/api/tracks/${active.id}/play`, { method: 'POST' }).catch(() => {});
  }, [active, position]);

  const pickTrack = (id: string) => {
    if (activeId === id) {
      setIsPlaying((p) => !p);
    } else {
      setActiveId(id);
      setIsPlaying(true);
    }
  };

  const progress = active ? Math.min(100, (position / active.duration_seconds) * 100) : 0;

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center gap-3 rounded-lg bg-indigo-500/[0.08] p-3">
        <button
          type="button"
          onClick={() => active && pickTrack(active.id)}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          disabled={!active?.preview_url}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:opacity-40"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold italic text-white">
            {active?.title ?? 'No track'}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-[9px] text-white/60">{clock(position)}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-indigo-500 transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-mono text-[9px] text-white/60">
              {active ? clock(active.duration_seconds) : '0:00'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-h-48 divide-y divide-white/5 overflow-y-auto rounded-lg bg-white/[0.02]">
        {tracks.map((t) => {
          const isActive = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => pickTrack(t.id)}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-white/[0.04]',
                isActive && 'bg-indigo-500/[0.08]',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    'w-5 font-mono text-xs',
                    isActive ? 'text-indigo-400' : 'text-white/40',
                  )}
                >
                  {t.track_number.toString().padStart(2, '0')}
                </span>
                <span
                  className={cn(
                    'truncate text-xs',
                    isActive ? 'font-bold text-indigo-300' : 'text-white',
                  )}
                >
                  {t.title}
                </span>
              </span>
              <span className="font-mono text-[10px] text-white/50">
                {clock(t.duration_seconds)}
              </span>
            </button>
          );
        })}
      </div>

      <audio ref={audioRef} preload="none" aria-hidden="true" />
    </div>
  );
}
