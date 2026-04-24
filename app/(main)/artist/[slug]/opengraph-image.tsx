import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const alt = 'Artist on SynthCamp';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ArtistOGParams {
  params: Promise<{ slug: string }>;
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get('content-type') ?? 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Per-artist Open Graph card. Avatar circle on the left, display name +
 * bio on the right, SynthCamp logomark bottom-right. Gracefully falls
 * back to a text-only card if Supabase or the avatar fetch fails.
 */
export default async function ArtistOG({ params }: ArtistOGParams) {
  const { slug } = await params;

  let displayName = 'Artist';
  let bio: string | null = null;
  let avatarDataUrl: string | null = null;

  try {
    const supabase = await getSupabaseServerClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, bio')
      .eq('slug', slug)
      .single();

    if (profile) {
      displayName = profile.display_name;
      bio = profile.bio;
      if (profile.avatar_url) {
        avatarDataUrl = await fetchAsDataUrl(profile.avatar_url);
      }
    }
  } catch {
    // Text-only fallback.
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
        {/* Bicolor backdrop: dark left, indigo right, separated by a soft
            vertical bezier curve so the OG doesn't feel flat. */}
        <svg
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <linearGradient id="og-bg-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#312e81" />
            </linearGradient>
            <radialGradient id="og-glow" cx="0.18" cy="0.85" r="0.55">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M 470,0 C 620,200 400,440 500,630 L 1200,630 L 1200,0 Z" fill="url(#og-bg-grad)" />
          <circle cx="260" cy="470" r="320" fill="url(#og-glow)" />
        </svg>

        {/* Avatar circle on the left */}
        {avatarDataUrl ? (
          <img
            src={avatarDataUrl}
            width={340}
            height={340}
            alt=""
            style={{
              position: 'absolute',
              left: 100,
              top: 145,
              width: 340,
              height: 340,
              objectFit: 'cover',
              borderRadius: 340,
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              border: '4px solid rgba(255,255,255,0.08)',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              left: 100,
              top: 145,
              width: 340,
              height: 340,
              borderRadius: 340,
              background: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 180,
              fontWeight: 900,
              color: '#ffffff',
              textTransform: 'uppercase',
            }}
          >
            {displayName.charAt(0)}
          </div>
        )}

        {/* Identity block on the right */}
        <div
          style={{
            position: 'absolute',
            left: 500,
            right: 80,
            top: 170,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 16,
              letterSpacing: '0.35em',
              fontWeight: 900,
              color: '#a5b4fc',
              textTransform: 'uppercase',
              transform: 'skewX(-10deg)',
            }}
          >
            Artist on SynthCamp
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: '#ffffff',
              textTransform: 'uppercase',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              transform: 'skewX(-10deg)',
              maxHeight: 240,
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {displayName}
          </div>
          {bio && (
            <div
              style={{
                fontSize: 24,
                color: '#e0e7ff',
                lineHeight: 1.3,
                maxHeight: 95,
                overflow: 'hidden',
                display: 'flex',
                marginTop: 4,
              }}
            >
              {bio.length > 120 ? bio.slice(0, 117) + '…' : bio}
            </div>
          )}
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
