import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type TrackUpdate = Database['public']['Tables']['tracks']['Update'];

const ALLOWED_FIELDS = [
  'title',
  'track_number',
  'audio_source_key',
  'credit_category',
  'credit_tags',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  const { trackId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const updates: TrackUpdate = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) {
      (updates as Record<string, unknown>)[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const { error } = await supabase.from('tracks').update(updates).eq('id', trackId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  const { trackId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // RLS enforces: only delete if release is in draft
  const { error } = await supabase.from('tracks').delete().eq('id', trackId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
