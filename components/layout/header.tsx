'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { LogoS } from '@/components/branding/logo-s';
import { ModeToggle, type Mode } from '@/components/ui/mode-toggle';
import { Sidebar } from '@/components/layout/sidebar';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import type { Profile } from '@/lib/data/profile';

interface HeaderProps {
  profile: Profile | null;
  unreadCount: number;
}

export function Header({ profile, unreadCount }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentMode: Mode = pathname.startsWith('/artist') ? 'artist' : 'explore';

  const handleModeChange = (mode: Mode) => {
    router.push(mode === 'explore' ? '/explore/home' : '/artist/catalog');
  };

  return (
    <>
      <header className="fixed top-0 right-0 left-0 z-50 bg-gradient-to-b from-[#050507] via-[#050507]/90 to-transparent p-4 pt-6 pb-24 md:p-8 md:pt-10">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3 md:gap-6">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
            <div className="flex min-w-0 items-start gap-2 md:gap-4">
              <div className="mt-0.5 shrink-0">
                <LogoS size={28} className="md:scale-[1.14]" />
              </div>
              <div className="flex min-w-0 flex-col">
                <h1 className="pr-0.5 text-base leading-none font-black tracking-tighter whitespace-nowrap uppercase italic md:text-2xl">
                  SynthCamp
                </h1>
                <p className="mt-1.5 truncate text-[8px] leading-none font-bold tracking-[0.2em] text-white/60 uppercase italic sm:text-[10px] sm:tracking-[0.3em] md:mt-2">
                  <span className="hidden sm:inline">The </span>AI Music Marketplace
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile && <NotificationsBell initialUnread={unreadCount} />}
            <ModeToggle mode={currentMode} onChange={handleModeChange} />
          </div>
        </div>
      </header>

      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} profile={profile} />
    </>
  );
}
