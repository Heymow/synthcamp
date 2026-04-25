import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TrackRow } from './db.js';
import { downloadToFile, uploadFile } from './storage.js';

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

const PREVIEW_DURATION_SECONDS = 30;
const MP3_BITRATE_K = 128;

export interface PreviewEncodeResult {
  previewUrl: string; // public URL stored on tracks.preview_url
}

/**
 * Extract a 30-second slice from preview_start_seconds, encode as MP3 128k,
 * upload to R2 as a public-read object. Returns the public URL.
 *
 * If preview_enabled = false on the track, the caller (worker dispatcher)
 * skips this entirely and clears tracks.preview_url instead. We don't
 * encode a preview only to delete it.
 */
export async function encodePreview(args: {
  track: TrackRow;
  artistId: string;
  publicBaseUrl: string; // e.g. https://api.synthcamp.net or the R2 public endpoint
}): Promise<PreviewEncodeResult> {
  const { track, artistId, publicBaseUrl } = args;
  if (!track.audio_source_key) {
    throw new Error(`Track ${track.id} has no audio_source_key`);
  }

  const workDir = join('/tmp', `preview-${track.id}`);
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  try {
    const ext = (track.audio_source_key.split('.').pop() ?? 'mp3').toLowerCase();
    const sourcePath = join(workDir, `source.${ext}`);
    await downloadToFile(track.audio_source_key, sourcePath);

    const previewPath = join(workDir, 'preview.mp3');

    await new Promise<void>((resolve, reject) => {
      ffmpeg(sourcePath)
        .seekInput(track.preview_start_seconds)
        .duration(PREVIEW_DURATION_SECONDS)
        .audioCodec('libmp3lame')
        .audioBitrate(`${MP3_BITRATE_K}k`)
        .noVideo()
        .output(previewPath)
        .on('error', (err) => reject(new Error(`FFmpeg preview encode failed: ${err.message}`)))
        .on('end', () => resolve())
        .run();
    });

    const r2Key = `audio-preview/${artistId}/${track.release_id}/${track.id}.mp3`;
    const buf = await readFile(previewPath);
    await uploadFile({
      key: r2Key,
      bodyBuffer: buf,
      contentType: 'audio/mpeg',
      cacheControl: 'public, max-age=86400',
    });

    // Public URL — relies on R2 bucket public-read setting for the
    // audio-preview/* prefix. Adjust publicBaseUrl env to match the actual
    // R2 public endpoint or a CF custom-domain proxy.
    const previewUrl = `${publicBaseUrl.replace(/\/$/, '')}/${r2Key}`;

    return { previewUrl };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
