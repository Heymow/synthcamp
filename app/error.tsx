'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LogoS } from '@/components/branding/logo-s';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="view-enter mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-6 pb-32">
      <GlassPanel className="flex flex-col items-center space-y-6 p-12 text-center">
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
          <Link href="/explore/home">
            <Button variant="ghost" size="md">
              Back
            </Button>
          </Link>
        </div>
      </GlassPanel>
    </main>
  );
}
