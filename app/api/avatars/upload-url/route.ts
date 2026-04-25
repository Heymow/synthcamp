import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';

interface AvatarUploadBody {
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

  const limited = enforceLimit(`user:${user.id}:avatar:upload-url`, 10, 60);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as AvatarUploadBody | null;
  const ext = body?.filename?.split('.').pop()?.toLowerCase() ?? 'jpg';
  // Include a timestamp so the Next/Image CDN doesn't serve a stale cached
  // version after the artist replaces their avatar.
  const path = `user_${user.id}/avatar-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage.from('avatars').createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    signed_url: data.signedUrl,
    path,
    token: data.token,
  });
}
