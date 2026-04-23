import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { resolveOrigin } from '@/lib/auth/origin';

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  const origin = resolveOrigin(request);
  return NextResponse.redirect(`${origin}/explore/home`, { status: 303 });
}
