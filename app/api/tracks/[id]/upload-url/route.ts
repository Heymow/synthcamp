import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { enforceLimit } from '@/lib/api/limit';
import { requireActiveAccount } from '@/lib/api/require-active';
import { getR2Client, R2_BUCKET } from '@/lib/r2';

interface TrackUploadBody {
  filename?: string;
}

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
  const ext = body.filename?.split('.').pop() ?? 'mp3';
  const key = `artist_${user.id}/release_${track.release_id}/track_${track.track_number}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: 'audio/*',
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

  return NextResponse.json({ signed_url: signedUrl, key });
}
