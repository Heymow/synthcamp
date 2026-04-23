import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';

async function resolveTarget(slug: string) {
  const supabase = await getSupabaseServerClient();
  const { data: target } = await supabase
    .from('profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return { supabase, target };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { supabase, target } = await resolveTarget(slug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;
  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (target.id === user.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
  }

  const limited = enforceLimit(`user:${user.id}:follow`, 60, 60);
  if (limited) return limited;

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, followed_id: target.id });
  if (error && !/duplicate key/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, followed: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { supabase, target } = await resolveTarget(slug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;
  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const limited = enforceLimit(`user:${user.id}:follow`, 60, 60);
  if (limited) return limited;

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followed_id', target.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, followed: false });
}
