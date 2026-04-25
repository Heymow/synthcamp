import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'SynthCamp · The AI Music Marketplace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Cache the rendered PNG for 1h. The root card has no dynamic inputs,
// but every crawler hit was re-running font I/O and satori render.
export const revalidate = 3600;

/**
 * Read Outfit-Black.ttf from the repo. Committed locally so OG generation
 * stays deterministic and offline — fetching Google Fonts at request time
 * was unreliable (CDN would serve WOFF2 which satori can't render).
 */
async function loadOutfit(): Promise<Buffer | null> {
  try {
    return await readFile(join(process.cwd(), 'public/fonts/Outfit-Black.ttf'));
  } catch {
    return null;
  }
}

/**
 * Root Open Graph image. Keeps the hero photo as the backdrop and overlays
 * the SynthCamp logo, wordmark, and tagline so link previews on Discord /
 * iMessage / Twitter immediately identify the brand.
 *
 * Next.js file-based convention auto-wires this into <head> as og:image and
 * twitter:image, overriding any manual values declared in app/layout.tsx.
 */
export default async function OpengraphImage() {
  const [heroBuffer, outfitBlack] = await Promise.all([
    readFile(join(process.cwd(), 'public/mock-covers/hero.jpg')),
    loadOutfit(),
  ]);
  const heroBase64 = `data:image/jpeg;base64,${heroBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#050507',
          fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Hero photo backdrop */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroBase64}
          width={1200}
          height={630}
          alt=""
          style={{ position: 'absolute', inset: 0, objectFit: 'cover' }}
        />

        {/* Dark gradient overlay for legibility */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(5,5,7,0.15) 0%, rgba(5,5,7,0.65) 50%, rgba(5,5,7,0.95) 100%)',
          }}
        />

        {/* Logo + wordmark + tagline, bottom-left */}
        <div
          style={{
            position: 'absolute',
            left: 80,
            bottom: 80,
            right: 80,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 32,
          }}
        >
          {/* Logo S as inline SVG */}
          <svg width={140} height={140} viewBox="0 0 100 100" fill="none">
            <path
              d="M30 25C30 20 35 15 45 15H70C75 15 80 19 80 24C80 29 76 33 71 33H45C40 33 38 35 38 38C38 41 40 43 45 43H70C85 43 90 53 90 63C90 73 85 85 70 85H30C25 85 20 81 20 76C20 71 24 67 29 67H70C75 67 77 65 77 62C77 59 75 57 70 57H45C30 57 25 47 25 37C25 32 27 28 30 25Z"
              fill="url(#og-logo-grad)"
            />
            <defs>
              <linearGradient
                id="og-logo-grad"
                x1="20"
                y1="15"
                x2="90"
                y2="85"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#ffffff" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Outfit has no italic variant; satori won't synthesize oblique,
                so we skew the container to mimic the browser's synthetic
                italic that the site uses with font-style: italic. */}
            <div
              style={{
                fontSize: 96,
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 0.95,
                color: '#ffffff',
                textTransform: 'uppercase',
                transform: 'skewX(-10deg)',
              }}
            >
              SynthCamp
            </div>
            <div
              style={{
                fontSize: 26,
                letterSpacing: '0.2em',
                color: '#e0e7ff',
                textTransform: 'uppercase',
                fontWeight: 700,
                transform: 'skewX(-10deg)',
              }}
            >
              The AI Music Marketplace
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: outfitBlack
        ? [{ name: 'Outfit', data: outfitBlack, style: 'normal', weight: 900 }]
        : undefined,
    },
  );
}
