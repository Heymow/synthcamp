import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { resolveOrigin } from '@/lib/auth/origin';

function safeNext(raw: string | null): string {
  // Only accept in-app paths, and bounce away from auth pages so we don't
  // land the user right back on /auth/login after a successful login.
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/explore/home';
  if (raw.startsWith('/auth/')) return '/explore/home';
  return raw;
}

export async function GET(request: NextRequest) {
  const origin = resolveOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
}
