import {
  claimJob,
  markDone,
  requeueJob,
  fetchTrack,
  fetchReleaseArtist,
  updateTrackEncoded,
} from './db.js';
import { encodeFull } from './encode-full.js';
import { encodePreview } from './encode-preview.js';

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS ?? 3);
if (!process.env.R2_PUBLIC_BASE_URL) {
  throw new Error('R2_PUBLIC_BASE_URL is required (no fallback — set it explicitly in Railway vars)');
}
const PUBLIC_BASE_URL: string = process.env.R2_PUBLIC_BASE_URL;

let stopping = false;

process.on('SIGTERM', () => {
  console.log('[encoder] SIGTERM, stopping after current job');
  stopping = true;
});
process.on('SIGINT', () => {
  console.log('[encoder] SIGINT, stopping after current job');
  stopping = true;
});

async function processOneJob(): Promise<boolean> {
  const job = await claimJob();
  if (!job) return false;

  console.log(`[encoder] claimed job ${job.job_id} (${job.kind} for track ${job.track_id}, attempt ${job.attempts})`);

  try {
    const track = await fetchTrack(job.track_id);
    const release = await fetchReleaseArtist(track.release_id);

    if (job.kind === 'full') {
      await updateTrackEncoded({ trackId: track.id, encodeStatus: 'encoding' });
      const result = await encodeFull({ track, artistId: release.artist_id });
      await updateTrackEncoded({
        trackId: track.id,
        hlsManifestKey: result.hlsManifestKey,
        aesKeyId: track.id, // path is derived from track.id per spec §3
        encodeStatus: 'ready',
      });
      console.log(`[encoder] full encode done: ${result.segmentCount} segments`);
    } else if (job.kind === 'preview') {
      if (!track.preview_enabled) {
        // Artist disabled preview after the job was queued; clear preview_url
        // and skip encoding. Mark job succeeded so the worker moves on.
        await updateTrackEncoded({
          trackId: track.id,
          previewUrl: '',
          encodeStatus: track.preview_enabled ? 'encoding' : 'ready',
        });
        await markDone(job.job_id, 'succeeded');
        console.log(`[encoder] preview skipped (preview_enabled=false)`);
        return true;
      }
      const result = await encodePreview({
        track,
        artistId: release.artist_id,
        publicBaseUrl: PUBLIC_BASE_URL,
      });
      await updateTrackEncoded({
        trackId: track.id,
        previewUrl: result.previewUrl,
        encodeStatus: 'ready', // preview alone doesn't drop full readiness
      });
      console.log(`[encoder] preview encoded: ${result.previewUrl}`);
    }

    await markDone(job.job_id, 'succeeded');
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[encoder] job ${job.job_id} failed (attempt ${job.attempts}/${MAX_ATTEMPTS}): ${msg}`);

    if (job.attempts >= MAX_ATTEMPTS) {
      // Terminal failure: mark the job failed for the dispatcher table AND
      // flip the track's encode_status so the wizard surfaces a Retry CTA
      // (Lot 5).
      await markDone(job.job_id, 'failed', msg);
      await updateTrackEncoded({ trackId: job.track_id, encodeStatus: 'failed' });
    } else {
      // Re-queue for retry. The atomic claim RPC already incremented attempts
      // on the previous claim, so flipping status='pending' (with the error
      // message preserved on the row) lets the next poll cycle pick it back
      // up. Service-role bypasses RLS so the direct UPDATE is fine.
      await requeueJob(job.job_id, msg);
      console.log(`[encoder] job ${job.job_id} re-queued for retry (attempt ${job.attempts}/${MAX_ATTEMPTS})`);
    }
    return true; // we did process a job (success, retry, or terminal failure)
  }
}

async function loop(): Promise<void> {
  console.log(`[encoder] starting, poll interval ${POLL_INTERVAL_MS}ms`);
  while (!stopping) {
    try {
      const processed = await processOneJob();
      if (!processed) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (err) {
      console.error('[encoder] loop iteration error:', err);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
  console.log('[encoder] stopped');
}

loop().catch((err) => {
  console.error('[encoder] fatal:', err);
  process.exit(1);
});
