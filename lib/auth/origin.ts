import type { NextRequest } from 'next/server';

// Resolve the public origin (e.g. https://synthcamp.net) for server-side
// redirects. Railway's proxy does not set request.url to the public URL,
// so new URL(request.url).origin would sometimes return https://localhost:8080.
//
// Priority:
//   1. NEXT_PUBLIC_APP_URL env var
//   2. X-Forwarded-Host + X-Forwarded-Proto from the proxy
//   3. request.url origin as last-resort fallback
export function resolveOrigin(request: NextRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;

  return new URL(request.url).origin;
}
