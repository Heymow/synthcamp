import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Next.js 16 renamed the "middleware" convention to "proxy".
// Export function name must also be `proxy`.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and cron endpoints (cron auths via CRON_SECRET,
    // not user session — running auth.getUser there is wasted work).
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|mock-covers|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
