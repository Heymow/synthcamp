import { createClient } from '@supabase/supabase-js';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    // DEBUG: dump what's actually visible so we know what Railway is/isn't injecting.
    console.error(
      '[encoder] env injection diagnosis. Keys present:',
      Object.keys(process.env)
        .filter((k) => !k.startsWith('npm_') && !k.startsWith('PNPM_'))
        .sort()
        .join(', ') || '(none)',
    );
    throw new Error(`Missing env: ${name}`);
  }
  return v;
};

/**
 * Service-role client. Bypasses RLS — required because the encoder has no
 * user session. Reads tracks/encode_jobs and writes hls_manifest_key,
 * preview_url, encode_status. Calls claim_next_encode_job() and
 * mark_encode_job_done() RPCs.
 */
export const supabase = createClient(
  required('SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

export interface ClaimedJob {
  job_id: string;
  track_id: string;
  kind: 'full' | 'preview';
  attempts: number;
}

export interface TrackRow {
  id: string;
  release_id: string;
  audio_source_key: string | null;
  preview_start_seconds: number;
  preview_enabled: boolean;
  duration_seconds: number;
}

export interface ReleaseArtist {
  artist_id: string;
}

/**
 * Atomic claim. Returns null when no pending job is available.
 */
export async function claimJob(): Promise<ClaimedJob | null> {
  const { data, error } = await supabase.rpc('claim_next_encode_job');
  if (error) throw new Error(`claim_next_encode_job failed: ${error.message}`);
  if (!data || data.length === 0) return null;
  const row = data[0] as ClaimedJob;
  return row;
}

export async function markDone(
  jobId: string,
  status: 'succeeded' | 'failed',
  error?: string,
): Promise<void> {
  const { error: rpcErr } = await supabase.rpc('mark_encode_job_done', {
    p_job_id: jobId,
    p_status: status,
    p_error: error ?? null,
  });
  if (rpcErr) throw new Error(`mark_encode_job_done failed: ${rpcErr.message}`);
}

/**
 * Flip a job back to 'pending' so the next poll cycle re-claims it. Used
 * for retry between attempts. Service-role bypasses RLS, so the direct
 * UPDATE is allowed. Stores the previous attempt's error message for
 * audit but doesn't increment attempts (the next claim will).
 */
export async function requeueJob(jobId: string, error: string): Promise<void> {
  const { error: updErr } = await supabase
    .from('encode_jobs')
    .update({
      status: 'pending',
      last_error: error,
      claimed_at: null,
    })
    .eq('id', jobId);
  if (updErr) throw new Error(`requeueJob failed: ${updErr.message}`);
}

export async function fetchTrack(trackId: string): Promise<TrackRow> {
  const { data, error } = await supabase
    .from('tracks')
    .select('id, release_id, audio_source_key, preview_start_seconds, preview_enabled, duration_seconds')
    .eq('id', trackId)
    .single();
  if (error || !data) throw new Error(`fetchTrack(${trackId}) failed: ${error?.message ?? 'not found'}`);
  return data as TrackRow;
}

export async function fetchReleaseArtist(releaseId: string): Promise<ReleaseArtist> {
  const { data, error } = await supabase
    .from('releases')
    .select('artist_id')
    .eq('id', releaseId)
    .single();
  if (error || !data) throw new Error(`fetchReleaseArtist(${releaseId}) failed: ${error?.message ?? 'not found'}`);
  return data as ReleaseArtist;
}

export async function updateTrackEncoded(args: {
  trackId: string;
  hlsManifestKey?: string;
  aesKeyId?: string;
  previewUrl?: string;
  encodeStatus: 'encoding' | 'ready' | 'failed';
}): Promise<void> {
  const update: Record<string, unknown> = { encode_status: args.encodeStatus };
  if (args.hlsManifestKey !== undefined) update.hls_manifest_key = args.hlsManifestKey;
  if (args.aesKeyId !== undefined) update.aes_key_id = args.aesKeyId;
  if (args.previewUrl !== undefined) update.preview_url = args.previewUrl;
  const { error } = await supabase.from('tracks').update(update).eq('id', args.trackId);
  if (error) throw new Error(`updateTrackEncoded(${args.trackId}) failed: ${error.message}`);
}
