import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';

interface CoverUploadBody {
  release_id?: string;
  filename?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:cover:upload-url`, 20, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as CoverUploadBody | null;
  if (!body || !body.release_id || !body.filename) {
    return NextResponse.json(
      { error: 'release_id and filename required' },
      { status: 400 },
    );
  }

  // Verify release ownership
  const { data: release } = await supabase
    .from('releases')
    .select('id, artist_id')
    .eq('id', body.release_id)
    .single();
  if (!release || release.artist_id !== user.id) {
    return NextResponse.json({ error: 'Release not found or not owned' }, { status: 403 });
  }

  const ext = body.filename.split('.').pop() ?? 'jpg';
  const path = `artist_${user.id}/release_${body.release_id}/cover.${ext}`;

  const { data, error } = await supabase.storage.from('covers').createSignedUploadUrl(path);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    signed_url: data.signedUrl,
    path,
    token: data.token,
  });
}
