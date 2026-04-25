import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';

interface AvatarUploadBody {
  filename?: string;
}

const ALLOWED_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;
type AllowedExt = (typeof ALLOWED_IMAGE_EXTS)[number];
function isAllowedExt(s: string): s is AllowedExt {
  return (ALLOWED_IMAGE_EXTS as readonly string[]).includes(s);
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
  // Defense in depth on top of the bucket's MIME allowlist: parse the last
  // dot-segment, lowercase, and validate against a small whitelist so a
  // crafted filename can't smuggle `..` / `/` into the storage path.
  const rawExt = body?.filename?.split('.').pop()?.toLowerCase() ?? '';
  if (!isAllowedExt(rawExt)) {
    return NextResponse.json(
      { error: `Unsupported image format. Allowed: ${ALLOWED_IMAGE_EXTS.join(', ')}` },
      { status: 400 },
    );
  }
  const ext = rawExt;
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
