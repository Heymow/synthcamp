'use client';

import { useSyncExternalStore } from 'react';

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

// Device capability does not change at runtime; no subscription needed.
const subscribeLowEnd: (callback: () => void) => () => void = () => () => {};

function getLowEndSnapshot(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as NavigatorWithDeviceMemory).deviceMemory ?? 4;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  return isMobile && (cores < 6 || memory < 8);
}

function getLowEndServerSnapshot(): boolean {
  return false;
}

export function useIsLowEndDevice(): boolean {
  return useSyncExternalStore(subscribeLowEnd, getLowEndSnapshot, getLowEndServerSnapshot);
}

export function useBackground3DEnabled(): boolean {
  const reduced = usePrefersReducedMotion();
  const lowEnd = useIsLowEndDevice();
  return !reduced && !lowEnd;
}
