'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh } from 'three';
import type { Mode } from '@/components/ui/mode-toggle';

export interface BlobProps {
  mode: Mode;
}

const MODE_COLORS: Record<Mode, number> = {
  explore: 0x6366f1,
  artist: 0x4f46e5,
};

const COLOR_LERP_EPSILON = 0.001;

export function Blob({ mode }: BlobProps) {
  const meshRef = useRef<Mesh>(null);
  const targetColor = useRef(new THREE.Color(MODE_COLORS.explore));
  const lastMode = useRef<Mode | null>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Constant-cost rotation.
    mesh.rotation.y += 0.001;

    // Only re-set the target when the mode actually changed; skip the lerp
    // entirely once we're close enough to the target color.
    if (lastMode.current !== mode) {
      targetColor.current.set(MODE_COLORS[mode]);
      lastMode.current = mode;
    }

    const material = mesh.material as THREE.MeshPhongMaterial;
    const distSq =
      (material.color.r - targetColor.current.r) ** 2 +
      (material.color.g - targetColor.current.g) ** 2 +
      (material.color.b - targetColor.current.b) ** 2;
    if (distSq > COLOR_LERP_EPSILON) {
      material.color.lerp(targetColor.current, 0.03);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.8, 32, 32]} />
      <meshPhongMaterial
        color={MODE_COLORS.explore}
        transparent
        opacity={0.25}
        shininess={20}
        emissive={0x6366f1}
        emissiveIntensity={0.05}
      />
    </mesh>
  );
}
