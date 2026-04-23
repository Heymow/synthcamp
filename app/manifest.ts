import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SynthCamp — The AI Music Marketplace',
    short_name: 'SynthCamp',
    description:
      'Marketplace where the creative process is celebrated, not hidden.',
    start_url: '/explore/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050507',
    theme_color: '#050507',
    categories: ['music', 'entertainment', 'social'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
