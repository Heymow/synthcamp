import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type ReleaseUpdate = Database['public']['Tables']['releases']['Update'];

const ALLOWED_FIELDS = [
  'title',
  'description',
  'cover_url',
  'language',
  'genres',
  'credit_category',
  'credit_tags',
  'credit_narrative',
  'credits_per_track',
  'is_listed',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Check 24h edit lockout via RPC
  const { data: editable, error: editCheckErr } = await supabase.rpc('check_release_editable', {
    p_release_id: id,
  });
  if (editCheckErr) return NextResponse.json({ error: editCheckErr.message }, { status: 500 });
  if (editable === false) {
    return NextResponse.json({ error: 'Release is within 24h edit lockout' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const updates: ReleaseUpdate = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) {
      (updates as Record<string, unknown>)[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const { error } = await supabase.from('releases').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
