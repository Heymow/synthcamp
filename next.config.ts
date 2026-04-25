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
    ],
  },
};

export default withNextIntl(nextConfig);
