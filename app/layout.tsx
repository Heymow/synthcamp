import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '600', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthcamp.net';
const DEFAULT_TITLE = 'SynthCamp · The AI Music Marketplace';
const DEFAULT_DESCRIPTION =
  'Marketplace where the creative process is celebrated, not hidden.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: '%s · SynthCamp',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: 'SynthCamp',
  appleWebApp: {
    capable: true,
    title: 'SynthCamp',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    siteName: 'SynthCamp',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    // og:image is supplied by app/opengraph-image.tsx
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    // twitter:image falls back to the opengraph-image by convention
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#050507',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={outfit.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
