'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="view-enter mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel
        as="main"
        className="flex flex-col items-center space-y-6 p-12 text-center"
      >
        <LogoS size={48} />
        <h2 className="text-3xl leading-none font-black text-white uppercase italic">
          Signal scrambled
        </h2>
        <p className="text-sm text-white/70 italic">
          An unexpected error occurred during playback.
        </p>
        <div className="flex gap-3">
          <Button variant="primary" size="md" onClick={() => reset()}>
            Retry
          </Button>
          <Button asChild variant="ghost" size="md">
            <Link href="/explore/home">Back</Link>
          </Button>
        </div>
        {error.digest ? (
          <p className="font-mono text-[9px] text-white/40">{error.digest}</p>
        ) : null}
      </GlassPanel>
    </div>
  );
}
