// In-memory token-bucket rate limiter. Single-process only — if we ever run
// multiple Next.js instances behind a load balancer, swap for Redis/Upstash.
// For Phase 2 on Railway (one instance), this is enough to blunt brute-force
// abuse without adding an external dependency.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, remaining: limit - 1, resetSeconds: windowSeconds };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: limit - bucket.count,
    resetSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

// Opportunistic cleanup so the Map doesn't accumulate expired buckets forever.
if (typeof globalThis !== 'undefined' && !('__rl_cleanup__' in globalThis)) {
  (globalThis as unknown as Record<string, unknown>).__rl_cleanup__ = true;
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets.entries()) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }, 300_000);
  (interval as unknown as { unref?: () => void }).unref?.();
}
