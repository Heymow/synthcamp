'use client';

import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlayer, type PlayerTrack } from '@/components/player/mini-player-provider';

interface PlayReleaseButtonProps {
  track: PlayerTrack;
  label?: string;
}

export function PlayReleaseButton({ track, label = 'Play' }: PlayReleaseButtonProps) {
  const { play } = usePlayer();
  return (
    <Button
      variant="primary"
      size="md"
      onClick={() => play(track)}
      className="flex w-full items-center justify-center gap-2"
    >
      <Play size={16} />
      {label}
    </Button>
  );
}
