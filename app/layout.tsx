import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
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
  // NOTE: user-scalable intentionally omitted (a11y WCAG 1.4.4)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
