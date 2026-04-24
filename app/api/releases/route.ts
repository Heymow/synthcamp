import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import { slugify } from '@/lib/slug';
import type { Database } from '@/lib/database.types';

type ReleaseInsert = Database['public']['Tables']['releases']['Insert'];

interface CreateReleaseBody {
  title?: string;
  description?: string | null;
  cover_url?: string;
  language?: string | null;
  genres?: string[];
  credit_category?: Database['public']['Tables']['releases']['Row']['credit_category'];
  credit_tags?: string[];
  credit_narrative?: string | null;
  credits_per_track?: boolean;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:release:create`, 10, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as CreateReleaseBody | null;
  if (!body || !body.title || !body.cover_url) {
    return NextResponse.json({ error: 'title and cover_url required' }, { status: 400 });
  }

  // Collision-safe slug generation
  const baseSlug = slugify(body.title);
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const { data: existing } = await supabase
      .from('releases')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
    if (suffix > 100) {
      return NextResponse.json({ error: 'Could not generate unique slug' }, { status: 500 });
    }
  }

  const insertPayload: ReleaseInsert = {
    artist_id: user.id,
    title: body.title,
    slug,
    description: body.description ?? null,
    cover_url: body.cover_url,
    language: body.language ?? null,
    genres: body.genres ?? [],
    price_minimum: 0, // recomputed at publish
    credit_category: body.credit_category ?? 'ai_crafted',
    credit_tags: body.credit_tags ?? [],
    credit_narrative: body.credit_narrative ?? null,
    credits_per_track: body.credits_per_track ?? false,
    status: 'draft',
  };

  const { data, error } = await supabase
    .from('releases')
    .insert(insertPayload)
    .select('id, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
