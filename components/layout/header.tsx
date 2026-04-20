'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { LogoS } from '@/components/branding/logo-s';
import { ModeToggle, type Mode } from '@/components/ui/mode-toggle';
import { Sidebar } from '@/components/layout/sidebar';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentMode: Mode = pathname.startsWith('/artist') ? 'artist' : 'explore';

  const handleModeChange = (mode: Mode) => {
    router.push(mode === 'explore' ? '/explore/home' : '/artist/catalog');
  };

  return (
    <>
      <header className="fixed top-0 right-0 left-0 z-50 bg-gradient-to-b from-[#050507] via-[#050507]/90 to-transparent p-8 pt-10 pb-24">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
            <div className="flex items-start gap-4">
              <div className="mt-0.5">
                <LogoS />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl leading-none font-black tracking-tighter uppercase italic">
                  SynthCamp
                </h1>
                <p className="mt-2 text-[10px] leading-none font-bold tracking-[0.3em] text-white/60 uppercase italic">
                  The AI Music Marketplace
                </p>
              </div>
            </div>
          </div>
          <ModeToggle mode={currentMode} onChange={handleModeChange} />
        </div>
      </header>

      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
    </>
  );
}
