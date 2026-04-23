'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  durationSeconds: number;
}

interface PlayerContextType {
  current: PlayerTrack | null;
  isPlaying: boolean;
  positionSeconds: number;
  play: (track: PlayerTrack) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);

  useEffect(() => {
    if (!isPlaying || !current) return;
    const id = setInterval(() => {
      setPositionSeconds((p) => {
        if (p + 1 >= current.durationSeconds) {
          setIsPlaying(false);
          return current.durationSeconds;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, current]);

  const play = useCallback((track: PlayerTrack) => {
    setCurrent(track);
    setPositionSeconds(0);
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => setIsPlaying(false), []);

  const resume = useCallback(() => {
    if (!current) return;
    if (positionSeconds >= current.durationSeconds) setPositionSeconds(0);
    setIsPlaying(true);
  }, [current, positionSeconds]);

  const stop = useCallback(() => {
    setCurrent(null);
    setIsPlaying(false);
    setPositionSeconds(0);
  }, []);

  return (
    <PlayerContext.Provider
      value={{ current, isPlaying, positionSeconds, play, pause, resume, stop }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within MiniPlayerProvider');
  return ctx;
}
