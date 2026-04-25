import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Self-hosted Supabase storage (covers, avatars).
      { protocol: 'https', hostname: 'api.synthcamp.net' },
      // Decorative avatar stack on Sound Rooms cards. Phase 5 swaps these
      // for real followed-listener avatars; remove this entry then.
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      // Temp release cover used in the upload wizard's metadata step before
      // the artist uploads a real cover. The API requires a non-empty
      // cover_url, so the wizard seeds this fallback.
      { protocol: 'https', hostname: 'placehold.co' },
      // Cover_url written by scripts/seed.mjs for seeded demo releases.
      // Remove after we replace seed releases with real artist uploads.
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  // Anti-clickjacking: deny framing everywhere except /embed/*, which is
  // the only surface intended to be iframed by third-party sites. CSP
  // frame-ancestors is the modern directive and takes precedence over
  // X-Frame-Options where both are honored; we set both for older browsers.
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }],
      },
      {
        source: '/((?!embed).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
