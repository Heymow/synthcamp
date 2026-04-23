import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export function enforceLimit(key: string, limit: number, windowSeconds: number) {
  const res = rateLimit(key, limit, windowSeconds);
  if (res.ok) return null;
  return NextResponse.json(
    { error: 'Rate limited', retry_after_seconds: res.resetSeconds },
    { status: 429, headers: { 'Retry-After': String(res.resetSeconds) } },
  );
}
