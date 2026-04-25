import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import { getR2Client, R2_BUCKET } from '@/lib/r2';

interface TrackUploadBody {
  filename?: string;
  content_length?: number;
}

// Whitelist of allowed audio extensions and their corresponding concrete
// MIME types. R2/S3 reject wildcard MIME (`audio/*`) on signed PUTs, so the
// signed URL has to commit to one. The client must send the matching
// Content-Type header at upload time.
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  aiff: 'audio/aiff',
  wma: 'audio/x-ms-wma',
};

const MAX_AUDIO_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: trackId } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const suspended = await requireActiveAccount(supabase, user.id);
  if (suspended) return suspended;

  const limited = enforceLimit(`user:${user.id}:track:upload-url`, 30, 60);
  if (limited) return limited;

  // Fetch track with its release to verify ownership
  const { data: track } = await supabase
    .from('tracks')
    .select('id, release_id, track_number, releases!inner(artist_id)')
    .eq('id', trackId)
    .single();

  if (!track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  // The typed shape varies slightly depending on Supabase types resolution.
  // Defensive check on the joined release's artist_id:
  const releaseJoin = (track as unknown as { releases: { artist_id: string } | null }).releases;
  if (!releaseJoin || releaseJoin.artist_id !== user.id) {
    return NextResponse.json({ error: 'Not owner' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as TrackUploadBody;
  // Take ONLY the last segment after a dot, lowercase it, and validate
  // against the whitelist. This rejects filenames like `evil.mp3/../../x`
  // or no-dot filenames before they ever land in the R2 key.
  const rawExt = body.filename?.split('.').pop()?.toLowerCase() ?? '';
  if (!rawExt || !(rawExt in AUDIO_MIME)) {
    return NextResponse.json(
      {
        error: `Unsupported audio format. Allowed: ${Object.keys(AUDIO_MIME).join(', ')}`,
      },
      { status: 400 },
    );
  }
  const ext = rawExt;
  const contentType = AUDIO_MIME[ext];

  // Require a declared content_length so the signed URL pins it. The signed
  // header forces the client to send a matching Content-Length on PUT — R2
  // rejects mismatches with a signature error. Cap at MAX_AUDIO_BYTES so a
  // malicious caller can't sign a 10 GB upload.
  const declaredLen = body.content_length;
  if (
    typeof declaredLen !== 'number' ||
    !Number.isFinite(declaredLen) ||
    declaredLen <= 0 ||
    Math.floor(declaredLen) !== declaredLen
  ) {
    return NextResponse.json(
      { error: 'content_length (positive integer bytes) required' },
      { status: 400 },
    );
  }
  if (declaredLen > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_AUDIO_BYTES} bytes (200 MB).` },
      { status: 400 },
    );
  }

  const key = `artist_${user.id}/release_${track.release_id}/track_${track.track_number}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: declaredLen,
  });

  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(getR2Client(), cmd, { expiresIn: 3600 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to sign URL' },
      { status: 500 },
    );
  }

  return NextResponse.json({ signed_url: signedUrl, key, content_type: contentType });
}
