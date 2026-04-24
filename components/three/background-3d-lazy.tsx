'use client';

import dynamic from 'next/dynamic';
import { useBackground3DEnabled } from '@/lib/device';

/**
 * Client-side lazy wrapper for the WebGL background. The full Three.js bundle
 * (~1 MB) is only fetched on capable devices — mobile / low-end / reduced-motion
 * visitors see the static gradient fallback instantly and never download the
 * three.js chunk at all.
 */
const Background3D = dynamic(
  () => import('./background-3d').then((m) => ({ default: m.Background3D })),
  {
    ssr: false,
    loading: () => <GradientFallback />,
  },
);

function GradientFallback() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-0"
      style={{
        background:
          'radial-gradient(circle at 50% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)',
      }}
    />
  );
}

export function Background3DLazy() {
  const enabled = useBackground3DEnabled();
  if (!enabled) return <GradientFallback />;
  return <Background3D />;
}
