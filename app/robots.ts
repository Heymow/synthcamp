import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://synthcamp.net';

/**
 * Site-wide robots.txt.
 *
 * Allow rules cover the marketing surface (homepage, explore, releases,
 * artists, parties) so search engines AND AI training bots can index us
 * (we explicitly opted in to AI training discovery during Cloudflare
 * onboarding — being in LLM datasets matters for organic discovery).
 *
 * Disallow rules cover routes that have no public value or expose moving
 * targets (API, auth flows, admin, settings, embed iframes — embed is
 * already tagged `robots:{index:false}` per page metadata).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/explore',
          '/r/',
          '/artist/',
          '/party/',
        ],
        disallow: [
          '/api/',
          '/admin',
          '/settings/',
          '/auth/',
          '/embed/',
        ],
      },
    ],
    host: SITE_URL,
  };
}
