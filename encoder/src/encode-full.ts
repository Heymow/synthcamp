import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TrackRow } from './db.js';
import { downloadToFile, uploadFile } from './storage.js';
import { generateAesKey, buildKeyInfoFile } from './key.js';

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

const SEGMENT_SECONDS = 6;
const AAC_BITRATE_K = 256;

export interface FullEncodeResult {
  hlsManifestKey: string; // R2 key of playlist.m3u8
  segmentCount: number;
}

/**
 * Encode the source audio to HLS+AES-128 and upload the manifest, segments,
 * and key.bin to R2. Returns the R2 key of the manifest, which is stored on
 * `tracks.hls_manifest_key`.
 *
 * Workflow:
 * 1. Download source from R2 to /tmp/<trackId>/source.<ext>
 * 2. Generate AES key, write key.bin + key.info file
 * 3. Run FFmpeg → playlist.m3u8 + seg-NNN.ts in /tmp/<trackId>/
 * 4. Upload all segments + manifest + key.bin to audio-stream/<artistId>/<releaseId>/<trackId>/
 * 5. Cleanup /tmp/<trackId>/
 */
export async function encodeFull(args: {
  track: TrackRow;
  artistId: string;
}): Promise<FullEncodeResult> {
  const { track, artistId } = args;
  if (!track.audio_source_key) {
    throw new Error(`Track ${track.id} has no audio_source_key`);
  }

  const workDir = join('/tmp', `encode-${track.id}`);
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  try {
    const ext = (track.audio_source_key.split('.').pop() ?? 'mp3').toLowerCase();
    const sourcePath = join(workDir, `source.${ext}`);
    await downloadToFile(track.audio_source_key, sourcePath);

    const keyPath = join(workDir, 'key.bin');
    const keyInfoPath = join(workDir, 'key.info');
    const key = generateAesKey();
    await writeFile(keyPath, key);
    await writeFile(
      keyInfoPath,
      buildKeyInfoFile({ trackId: track.id, localKeyPath: keyPath }),
    );

    const playlistPath = join(workDir, 'playlist.m3u8');
    const segmentPattern = join(workDir, 'seg-%03d.ts');

    await new Promise<void>((resolve, reject) => {
      ffmpeg(sourcePath)
        .audioCodec('aac')
        .audioBitrate(`${AAC_BITRATE_K}k`)
        .noVideo()
        .outputOptions([
          '-hls_time', String(SEGMENT_SECONDS),
          '-hls_key_info_file', keyInfoPath,
          '-hls_segment_filename', segmentPattern,
          '-hls_playlist_type', 'vod',
          '-hls_segment_type', 'mpegts',
          '-f', 'hls',
        ])
        .output(playlistPath)
        .on('error', (err) => reject(new Error(`FFmpeg HLS encode failed: ${err.message}`)))
        .on('end', () => resolve())
        .run();
    });

    const r2Prefix = `audio-stream/${artistId}/${track.release_id}/${track.id}`;
    const files = await readdir(workDir);
    const segmentFiles = files.filter((f) => f.startsWith('seg-') && f.endsWith('.ts'));

    // Re-encode of an existing track may produce fewer segments than the
    // previous run, leaving orphan seg-NNN.ts in R2. We don't list+delete
    // here for v1 (R2 storage is cheap, and the manifest never references
    // them so they're effectively dead data). If storage cost becomes an
    // issue, add a list-old-and-delete pass here. Tracked as tech debt.

    // Upload segments in parallel (they're small ~1-2 MB each).
    await Promise.all(
      segmentFiles.map(async (f) => {
        const local = join(workDir, f);
        const buf = await readFile(local);
        await uploadFile({
          key: `${r2Prefix}/${f}`,
          bodyBuffer: buf,
          contentType: 'video/mp2t',
          cacheControl: 'public, max-age=31536000, immutable',
        });
      }),
    );

    // Upload key.bin (private — never served directly; the key endpoint reads it).
    await uploadFile({
      key: `${r2Prefix}/key.bin`,
      bodyPath: keyPath,
      contentType: 'application/octet-stream',
      cacheControl: 'private, no-store',
    });

    // Upload manifest last so partial-failure leaves the manifest absent
    // (the track row shows encode_status='encoding' / 'failed' until full success).
    const manifestBuf = await readFile(playlistPath);
    await uploadFile({
      key: `${r2Prefix}/playlist.m3u8`,
      bodyBuffer: manifestBuf,
      contentType: 'application/x-mpegURL',
      cacheControl: 'private, no-store',
    });

    return {
      hlsManifestKey: `${r2Prefix}/playlist.m3u8`,
      segmentCount: segmentFiles.length,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
