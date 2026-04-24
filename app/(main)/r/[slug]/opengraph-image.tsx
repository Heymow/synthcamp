import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const alt = 'Release on SynthCamp';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ReleaseOGParams {
  params: Promise<{ slug: string }>;
}

/**
 * Per-release Open Graph card. Cover on the left at poster size, release
 * title + artist on the right in the site's display typography, SynthCamp
 * logomark in the bottom right so viewers recognize the source even when
 * the image is lifted.
 */
export default async function ReleaseOG({ params }: ReleaseOGParams) {
  const { slug } = await params;
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

  const title = release?.title ?? 'SynthCamp';
  const artistName = release?.artist?.display_name ?? 'Unknown';
  const rawCoverUrl = release?.cover_url ?? null;

  // Pre-fetch cover server-side and inline as data URL — satori is unreliable
  // when reaching out to arbitrary hosts (self-hosted Supabase) at render time.
  let coverDataUrl: string | null = null;
  if (rawCoverUrl) {
    try {
      const r = await fetch(rawCoverUrl, { cache: 'no-store' });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        const mime = r.headers.get('content-type') ?? 'image/jpeg';
        coverDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch {
      coverDataUrl = null;
    }
  }
  const coverUrl = coverDataUrl;

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
        {/* Blurred cover as ambient backdrop */}
        {coverUrl && (
          <img
            src={coverUrl}
            width={1200}
            height={630}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              objectFit: 'cover',
              filter: 'blur(40px) brightness(0.35)',
              transform: 'scale(1.1)',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(120deg, rgba(5,5,7,0.85) 0%, rgba(5,5,7,0.4) 100%)',
          }}
        />

        {/* Poster cover on the left */}
        {coverUrl && (
          <img
            src={coverUrl}
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
            left: 590,
            right: 80,
            top: 110,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
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
              // Clamp extremely long titles with a soft max
              maxHeight: 220,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: '#e0e7ff',
              textTransform: 'uppercase',
              transform: 'skewX(-10deg)',
            }}
          >
            by {artistName}
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
