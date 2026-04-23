import { Background3D } from '@/components/three/background-3d';
import { Header } from '@/components/layout/header';
import { MiniPlayer } from '@/components/player/mini-player';
import { MiniPlayerProvider } from '@/components/player/mini-player-provider';
import { getCurrentProfile } from '@/lib/data/profile';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <MiniPlayerProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-indigo-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>
      <Background3D />
      <div className="ui-overlay pb-32">
        <Header profile={profile} />
        <div className="h-40" aria-hidden="true" />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
      <MiniPlayer />
    </MiniPlayerProvider>
  );
}
