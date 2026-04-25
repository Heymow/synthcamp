import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { fetchAsDataUrl } from '@/lib/og/fetch-image';

export const alt = 'Artist on SynthCamp';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Cache the rendered PNG for 1h. Crawlers (Discord, iMessage, Twitter,
// link-preview bots) hit these routes repeatedly per share; without
// revalidate every hit re-ran a Supabase read, a remote image fetch,
// and a satori render.
export const revalidate = 3600;

interface ArtistOGParams {
  params: Promise<{ slug: string }>;
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
