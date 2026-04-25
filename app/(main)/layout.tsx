import { getTranslations } from 'next-intl/server';
import { Background3DLazy } from '@/components/three/background-3d-lazy';
import { Header } from '@/components/layout/header';
import { MiniPlayer } from '@/components/player/mini-player';
import { MiniPlayerProvider } from '@/components/player/mini-player-provider';
import { NowProvider } from '@/lib/now-context';
import { getCurrentProfile } from '@/lib/data/profile';
import { getUnreadNotificationsCount } from '@/lib/data/notifications';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('nav');
  const profile = await getCurrentProfile();
  const unreadCount = profile ? await getUnreadNotificationsCount(profile.id) : 0;

  return (
    <NowProvider>
      <MiniPlayerProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-indigo-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
        >
          {t('skipToContent')}
        </a>
        <Background3DLazy />
        <div className="ui-overlay pb-32">
          <Header profile={profile} unreadCount={unreadCount} />
          {/* Spacer is intentionally shorter than the actual header height on
              mobile (96px vs ~128px). The header's pb-12 gradient fade is
              meant to bleed onto the top of the page content, creating a soft
              transition. Don't "fix" this to match the exact header bbox. */}
          <div className="h-24 md:h-40" aria-hidden="true" />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>
        <MiniPlayer />
      </MiniPlayerProvider>
    </NowProvider>
  );
}
