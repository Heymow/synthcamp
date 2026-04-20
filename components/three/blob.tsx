'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Mesh } from 'three';
import type { Mode } from '@/components/ui/mode-toggle';

export interface BlobProps {
  mode: Mode;
}

export function Blob({ mode }: BlobProps) {
  const meshRef = useRef<Mesh>(null);
  const targetColor = useRef(new THREE.Color(0x6366f1));

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const desiredColor = mode === 'explore' ? 0x6366f1 : 0x4f46e5;
    targetColor.current.set(desiredColor);

    const material = mesh.material as THREE.MeshStandardMaterial;
    material.color.lerp(targetColor.current, 0.03);
    mesh.rotation.y += 0.001;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[2.8, 32, 32]} />
      <meshStandardMaterial
        color={0x6366f1}
        transparent
        opacity={0.25}
        roughness={0.2}
        metalness={0.1}
        emissive={0x6366f1}
        emissiveIntensity={0.05}
      />
    </mesh>
  );
}
