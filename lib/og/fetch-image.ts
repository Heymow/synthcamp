/**
 * SSRF-safe image fetch for Open Graph cards.
 *
 * Both /r/[slug]/opengraph-image and /artist/[slug]/opengraph-image used
 * to fetch arbitrary URLs from artist-controlled fields (cover_url,
 * avatar_url) and re-encode them as data URLs. A hostile profile could
 * point those at internal services (cloud metadata, intra-network
 * services, file://, etc.) and have the OG render endpoint act as a
 * confused deputy.
 *
 * Defense:
 *   - Scheme MUST be https:.
 *   - Hostname MUST be in an allowlist driven by env var OG_IMAGE_HOSTS
 *     (comma-separated). Wildcards of the form `*.domain.tld` are
 *     supported (matches one or more leading subdomain labels).
 *   - On any validation failure, return null. Both callers already
 *     gracefully render a text-only fallback when null.
 */

const DEFAULT_HOSTS = 'api.synthcamp.net,*.synthcamp.net,r2.cloudflarestorage.com';

/**
 * Match a hostname against a single allowlist entry. The entry is either
 * an exact host (e.g. `api.synthcamp.net`) or a `*.domain.tld` wildcard
 * matching one or more leading subdomain labels (e.g. `*.synthcamp.net`
 * matches `cdn.synthcamp.net` and `a.b.synthcamp.net` but not the bare
 * `synthcamp.net`).
 */
function hostMatches(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase().trim();
  if (!p) return false;
  if (p.startsWith('*.')) {
    const suffix = p.slice(1); // ".synthcamp.net"
    return h.endsWith(suffix) && h.length > suffix.length;
  }
  return h === p;
}

function getAllowedHosts(): string[] {
  const raw = process.env.OG_IMAGE_HOSTS ?? DEFAULT_HOSTS;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Returns true iff `url` is safe to fetch as an OG cover/avatar source.
 * Exported for tests; the runtime callsite uses `fetchAsDataUrl` which
 * also performs the fetch.
 */
export function isAllowedOgImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const allowed = getAllowedHosts();
  return allowed.some((p) => hostMatches(parsed.hostname, p));
}

/**
 * Fetch an external image and return it as a `data:` URL. Returns null on
 * any disallowed URL, network error, non-2xx response, or timeout. Both
 * OG render routes treat null as "fall back to text-only card".
 */
export async function fetchAsDataUrl(url: string): Promise<string | null> {
  if (!isAllowedOgImageUrl(url)) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    // No `cache: 'no-store'` here: callers are OG render routes that
    // declare `export const revalidate = 3600`. Letting this fetch
    // participate in Next's request cache means a hot release/artist's
    // cover poster is fetched at most once per revalidation window
    // instead of on every crawler hit.
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: 'error', // don't follow redirects to off-allowlist hosts
    });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = r.headers.get('content-type') ?? 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
