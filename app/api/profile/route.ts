import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

interface PatchBody {
  display_name?: string;
  slug?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const updates: ProfileUpdate = {};
  if (typeof body.display_name === 'string') updates.display_name = body.display_name;
  if (body.slug === null || typeof body.slug === 'string') updates.slug = body.slug;
  if (body.bio === null || typeof body.bio === 'string') updates.bio = body.bio;
  if (body.avatar_url === null || typeof body.avatar_url === 'string')
    updates.avatar_url = body.avatar_url;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
