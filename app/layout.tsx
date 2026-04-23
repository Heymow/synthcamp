import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { Background3D } from '@/components/three/background-3d';
import { Header } from '@/components/layout/header';
import { MiniPlayer } from '@/components/player/mini-player';
import { getCurrentProfile } from '@/lib/data/profile';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '600', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SynthCamp — The AI Music Marketplace',
  description: 'Marketplace where the creative process is celebrated, not hidden.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <Background3D />
        <div className="ui-overlay pb-32">
          <Header profile={profile} />
          <div className="h-40" aria-hidden="true" />
          {children}
        </div>
        <MiniPlayer />
      </body>
    </html>
  );
}
