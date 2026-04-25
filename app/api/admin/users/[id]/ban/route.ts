import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/require-admin';

interface BanBody {
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, err } = await requireAdmin();
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, err } = await requireAdmin();
  if (err) return err;

  const { error } = await supabase.rpc('admin_unban_user', { p_user_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, banned: false });
}
