import { randomBytes } from 'node:crypto';

/**
 * Generate a 16-byte AES-128 key. Returned as a Buffer; FFmpeg's HLS muxer
 * reads it as a binary file via the key info file's path line.
 */
export function generateAesKey(): Buffer {
  return randomBytes(16);
}

/**
 * Produce the FFmpeg key info file content. Format:
 *   line 1: URI the player will request (placeholder; real signed URL is
 *           inserted at request time by the manifest endpoint in Lot 4)
 *   line 2: local path to the key.bin file (so FFmpeg can read the bytes)
 *   line 3: optional IV (hex, 32 chars)
 *
 * We bake a fixed placeholder URL into the manifest. The Lot 4 manifest
 * endpoint rewrites the URI per request to attach a short-lived JWT.
 */
export function buildKeyInfoFile(args: {
  trackId: string;
  localKeyPath: string;
  iv?: string;
}): string {
  const placeholderUri = `https://synthcamp.net/api/tracks/${args.trackId}/key`;
  const lines = [placeholderUri, args.localKeyPath];
  if (args.iv) lines.push(args.iv);
  return lines.join('\n') + '\n';
}
