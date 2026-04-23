import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface BanBody {
  reason?: string;
}

async function requireAdmin(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, err: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    return { supabase, user, err: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  }
  return { supabase, user, err: null as null };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, err } = await requireAdmin(request);
  if (err) return err;

  const body = (await request.json().catch(() => ({}))) as BanBody;
  const reason = (body.reason ?? '').trim().slice(0, 500);

  const { error } = await supabase.rpc('admin_ban_user', {
    p_user_id: id,
    p_reason: reason || 'No reason provided',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, banned: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, err } = await requireAdmin(request);
  if (err) return err;

  const { error } = await supabase.rpc('admin_unban_user', { p_user_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, banned: false });
}
