import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fetchAsDataUrl } from '@/lib/og/fetch-image';

export const alt = 'Release on SynthCamp';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Cache the rendered PNG for 1h. Crawlers (Discord, iMessage, Twitter,
// link-preview bots) hit these routes repeatedly per share; without
// revalidate every hit re-ran a Supabase read, a remote image fetch,
// and a satori render.
export const revalidate = 3600;

interface ReleaseOGParams {
  params: Promise<{ slug: string }>;
}

/**
 * Per-release Open Graph card. Cover poster on the left, title + artist on
 * the right, SynthCamp logomark bottom-right. Falls back to a purely
 * text-based card if Supabase or the cover fetch fails — we never let the
 * route 500 because that breaks link previews everywhere.
 */
export default async function ReleaseOG({ params }: ReleaseOGParams) {
  const { slug } = await params;

  let title = 'SynthCamp';
  let artistName = 'Unknown';
  let coverDataUrl: string | null = null;

  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase
      .from('releases')
      .select(
        'title, cover_url, artist:profiles!releases_artist_id_fkey(display_name)',
      )
      .eq('slug', slug)
      .in('status', ['published', 'unlisted', 'scheduled'])
      .single();

    const release = data as unknown as {
      title: string;
      cover_url: string;
      artist: { display_name: string } | null;
    } | null;

    if (release) {
      title = release.title;
      artistName = release.artist?.display_name ?? 'Unknown';
      if (release.cover_url) {
        coverDataUrl = await fetchAsDataUrl(release.cover_url);
      }
    }
  } catch {
    // Fall through to defaults, render a text-only card.
  }

  const outfit = await readFile(join(process.cwd(), 'public/fonts/Outfit-Black.ttf'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#050507',
          fontFamily: 'Outfit, system-ui, sans-serif',
        }}
      >
        {/* Aurora backdrop: overlapping soft radial gradients in the site's
            indigo palette with warm accents, matching the GMC flame glow. */}
        <svg
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <radialGradient id="aurora-1" cx="0.25" cy="0.3" r="0.55">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="aurora-2" cx="0.72" cy="0.65" r="0.55">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="aurora-3" cx="0.58" cy="0.45" r="0.35">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="aurora-warm-1" cx="0.15" cy="0.8" r="0.35">
              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="aurora-warm-2" cx="0.85" cy="0.2" r="0.3">
              <stop offset="0%" stopColor="#fb923c" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1200" height="630" fill="url(#aurora-1)" />
          <rect width="1200" height="630" fill="url(#aurora-2)" />
          <rect width="1200" height="630" fill="url(#aurora-3)" />
          <rect width="1200" height="630" fill="url(#aurora-warm-1)" />
          <rect width="1200" height="630" fill="url(#aurora-warm-2)" />
        </svg>

        {/* Poster cover on the left */}
        {coverDataUrl && (
          <img
            src={coverDataUrl}
            width={450}
            height={450}
            alt=""
            style={{
              position: 'absolute',
              left: 80,
              top: 90,
              width: 450,
              height: 450,
              objectFit: 'cover',
              borderRadius: 32,
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
          />
        )}

        {/* Title block on the right */}
        <div
          style={{
            position: 'absolute',
            left: coverDataUrl ? 590 : 80,
            right: 80,
            top: 110,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              letterSpacing: '0.3em',
              fontWeight: 900,
              color: '#a5b4fc',
              textTransform: 'uppercase',
              transform: 'skewX(-10deg)',
            }}
          >
            New on SynthCamp
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#ffffff',
              textTransform: 'uppercase',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              transform: 'skewX(-10deg)',
              maxHeight: 220,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: '#e0e7ff',
              textTransform: 'uppercase',
              transform: 'skewX(-10deg)',
            }}
          >
            {`by ${artistName}`}
          </div>
        </div>

        {/* SynthCamp logomark bottom-right */}
        <div
          style={{
            position: 'absolute',
            right: 80,
            bottom: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <svg width={44} height={44} viewBox="0 0 100 100" fill="none">
            <path
              d="M30 25C30 20 35 15 45 15H70C75 15 80 19 80 24C80 29 76 33 71 33H45C40 33 38 35 38 38C38 41 40 43 45 43H70C85 43 90 53 90 63C90 73 85 85 70 85H30C25 85 20 81 20 76C20 71 24 67 29 67H70C75 67 77 65 77 62C77 59 75 57 70 57H45C30 57 25 47 25 37C25 32 27 28 30 25Z"
              fill="url(#sc-grad)"
            />
            <defs>
              <linearGradient id="sc-grad" x1="20" y1="15" x2="90" y2="85" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffffff" />
                <stop offset="1" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              textTransform: 'uppercase',
              transform: 'skewX(-10deg)',
            }}
          >
            SynthCamp
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Outfit', data: outfit, style: 'normal', weight: 900 }],
    },
  );
}
