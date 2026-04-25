'use client';

import { Canvas } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { Blob } from '@/components/three/blob';
import type { Mode } from '@/components/ui/mode-toggle';

// This component is only rendered by `Background3DLazy` once the capability
// gate has passed, so we can assume the WebGL canvas should always render here.
export function Background3D() {
  const pathname = usePathname();
  const mode: Mode = pathname.startsWith('/artist') ? 'artist' : 'explore';

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 opacity-60">
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 6] }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <pointLight color={0xffffff} intensity={1.2} distance={50} position={[5, 5, 5]} />
        <ambientLight color={0x222222} />
        <Blob mode={mode} />
      </Canvas>
    </div>
  );
}
