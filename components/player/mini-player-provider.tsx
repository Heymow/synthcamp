'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  durationSeconds: number;
  previewUrl?: string | null;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync <audio> element with track + play state. Falls back to a 1-second
  // fake interval when the track has no previewUrl (demo catalogue without
  // seeded audio).
  const hasAudio = Boolean(current?.previewUrl);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (current?.previewUrl) {
      if (el.src !== current.previewUrl) {
        el.src = current.previewUrl;
        el.load();
      }
    } else {
      el.removeAttribute('src');
      el.load();
    }
  }, [current]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !hasAudio) return;
    if (isPlaying) {
      void el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [isPlaying, hasAudio]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setPositionSeconds(el.currentTime);
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || !current || hasAudio) return;
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
  }, [isPlaying, current, hasAudio]);

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
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
  }, []);

  return (
    <PlayerContext.Provider
      value={{ current, isPlaying, positionSeconds, play, pause, resume, stop }}
    >
      {children}
      <audio ref={audioRef} preload="none" aria-hidden="true" />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within MiniPlayerProvider');
  return ctx;
}
