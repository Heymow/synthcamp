'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Library, LayoutGrid, Upload, Users, DollarSign } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { SidebarItem } from '@/components/layout/sidebar-item';
import { LogoS } from '@/components/branding/logo-s';

export interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isExplore = pathname.startsWith('/explore');

  const go = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="left" title="SynthCamp menu">
      <div className="p-8 pb-12">
        <div className="flex items-start gap-4">
          <LogoS />
          <div className="flex flex-col">
            <h2 className="text-xl leading-none font-black tracking-tighter uppercase italic">
              SynthCamp
            </h2>
            <p className="mt-1 text-[9px] leading-none font-bold tracking-[0.3em] text-white/60 uppercase italic">
              Menu
            </p>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100%-120px)] flex-col justify-between">
        <nav aria-label="Primary">
          {isExplore ? (
            <>
              <SidebarItem
                icon={<Home size={18} strokeWidth={2.5} />}
                label="Home"
                active={pathname === '/explore/home'}
                onClick={() => go('/explore/home')}
              />
              <SidebarItem
                icon={<Search size={18} strokeWidth={2.5} />}
                label="Search"
                active={pathname === '/explore/search'}
                onClick={() => go('/explore/search')}
              />
              <SidebarItem
                icon={<Library size={18} strokeWidth={2.5} />}
                label="Library"
                active={pathname === '/explore/library'}
                onClick={() => go('/explore/library')}
              />
            </>
          ) : (
            <>
              <SidebarItem
                icon={<LayoutGrid size={18} strokeWidth={2.5} />}
                label="My Music"
                active={pathname === '/artist/catalog'}
                onClick={() => go('/artist/catalog')}
              />
              <SidebarItem
                icon={<Upload size={18} strokeWidth={2.5} />}
                label="New Release"
                active={pathname === '/artist/upload'}
                onClick={() => go('/artist/upload')}
              />
              <SidebarItem
                icon={<Users size={18} strokeWidth={2.5} />}
                label="Live Parties"
                active={pathname === '/artist/parties'}
                onClick={() => go('/artist/parties')}
              />
              <SidebarItem
                icon={<DollarSign size={18} strokeWidth={2.5} />}
                label="Earnings"
                active={pathname === '/artist/sales'}
                onClick={() => go('/artist/sales')}
              />
            </>
          )}
        </nav>

        <div className="space-y-4 border-t border-white/5 p-8">
          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black">
              JD
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase">John Doe</span>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
