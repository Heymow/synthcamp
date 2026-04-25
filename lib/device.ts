'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

// deviceMemory is not in the standard Navigator lib types yet.
type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number };

function isLowEndClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as NavigatorWithDeviceMemory).deviceMemory ?? 4;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  if (isMobile) return cores < 6 || memory < 8;
  // Desktop heuristic: still flag genuinely weak machines.
  return cores < 4 || memory < 4;
}

/**
 * Whether the WebGL background should be enabled. Returns `false` on the
 * server AND on the first client render so server- and client-rendered markup
 * match (no hydration mismatch). After mount, `useEffect` runs the capability
 * check and may flip to `true`.
 */
export function useBackground3DEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setEnabled(false);
      return;
    }
    setEnabled(!isLowEndClient());
  }, [reduced]);

  return enabled;
}
