'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePlayer, type PlayerTrack } from '@/components/player/mini-player-provider';

interface AutoCueProps {
  tracks: PlayerTrack[];
}

// When the current URL carries ?t=<track-id> and the player isn't already on
// that track, cue it (set current, but don't start playing — browsers block
// autoplay without gesture). The user still clicks Play to start.
export function AutoCue({ tracks }: AutoCueProps) {
  const searchParams = useSearchParams();
  const { current, cue } = usePlayer();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const t = searchParams.get('t');
    if (!t || handled.current === t) return;
    const match = tracks.find((track) => track.id === t);
    if (!match) return;
    if (current?.id === t) {
      handled.current = t;
      return;
    }
    cue(match);
    handled.current = t;
  }, [searchParams, tracks, current, cue]);

  return null;
}
