# Phase 3 Lot 2 — Encoder Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a dedicated Railway service that polls `claim_next_encode_job()`, transcodes uploaded source audio into HLS+AES-128 streaming bundles + 30-second MP3 previews, uploads outputs to R2, and updates `tracks` rows accordingly.

**Architecture:** New top-level `encoder/` workspace, Node 20 + TypeScript. Uses `ffmpeg-static` (binary bundled in node_modules — no system FFmpeg needed on the Railway runner), `@aws-sdk/client-s3` for R2 (S3-compatible), and `@supabase/supabase-js` with the service-role key for DB access. Jobs are claimed atomically via the `claim_next_encode_job()` RPC from Lot 1; `mark_encode_job_done()` records success/failure. Errors retry up to 3 times then mark `tracks.encode_status='failed'`.

**Tech Stack:** Node 20, TypeScript, fluent-ffmpeg, ffmpeg-static, @aws-sdk/client-s3, @aws-sdk/lib-storage, @supabase/supabase-js, vitest (smoke tests).

**Out of scope:** Stripe webhook + Checkout (Lot 3), key delivery + manifest signing endpoints (Lot 4), UI for preview controls + buy CTAs (Lot 5), full E2E (Lot 6).

---

## Reference

- Spec: `docs/superpowers/specs/2026-04-25-phase3-paywall-drm-design.md` (commit `4ddc390`)
- Lot 1 plan: `docs/superpowers/plans/2026-04-25-phase3-lot1-foundation.md`
- Existing track upload route: `app/api/tracks/[id]/upload-url/route.ts` (writes source to `artist_<user_id>/release_<release_id>/track_<n>.<ext>` in the audio bucket)
- R2 client setup template: `lib/r2.ts` (the Next.js side — encoder mirrors but with service-role-equivalent R2 keys)

---

## Storage layout (target)

R2 single bucket, multiple top-level prefixes:

| Path | Content | Cache |
|---|---|---|
| `audio-source/artist_<uid>/release_<rid>/track_<n>.<ext>` | Original upload, kept for re-encode | private |
| `audio-stream/<artist_id>/<release_id>/<track_id>/playlist.m3u8` | HLS manifest, baked at encode time | private |
| `audio-stream/<artist_id>/<release_id>/<track_id>/seg-NNN.ts` | Encrypted AAC segments | private |
| `audio-stream/<artist_id>/<release_id>/<track_id>/key.bin` | 16-byte AES key | private (never served) |
| `audio-preview/<artist_id>/<release_id>/<track_id>.mp3` | 30-second MP3 preview | public |

The `audio-stream` segments are publicly fetchable (their content is encrypted; the security boundary is the key endpoint added in Lot 4). `audio-preview/*.mp3` is plain MP3 served as the existing `tracks.preview_url`. `audio-source/*` and `key.bin` are never publicly readable.

---

## Task 1: Initialize the encoder workspace

**Files:**
- Create: `encoder/package.json`
- Create: `encoder/tsconfig.json`
- Create: `encoder/.gitignore`
- Create: `encoder/Dockerfile` (Railway-friendly Node 20 + bundled ffmpeg-static)
- Create: `encoder/README.md`
- Modify: `package.json` (root) — add the encoder workspace

- [ ] **Step 1: Add the encoder workspace to the root**

The root project uses pnpm (`pnpm-lock.yaml` is present, no `package-lock.json`). Create `pnpm-workspace.yaml` at the repo root:

```yaml
packages:
  - encoder
```

Do NOT add a `workspaces` field to the root `package.json` — pnpm reads from the YAML file, not the JSON. Mixing the two confuses tooling.

- [ ] **Step 2: Write `encoder/package.json`**

```json
{
  "name": "synthcamp-encoder",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node --import tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/lib-storage": "^3.700.0",
    "@supabase/supabase-js": "^2.45.0",
    "fluent-ffmpeg": "^2.1.3",
    "ffmpeg-static": "^5.2.0"
  },
  "devDependencies": {
    "@types/fluent-ffmpeg": "^2.1.27",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write `encoder/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `encoder/.gitignore`**

```
node_modules/
dist/
.env
.env.*
/tmp/
*.log
```

- [ ] **Step 5: Write `encoder/Dockerfile`** (Railway uses Nixpacks by default but a Dockerfile gives us deterministic FFmpeg)

```dockerfile
FROM node:22-bookworm-slim

WORKDIR /app

# ffmpeg-static ships a Linux binary in node_modules, so no apt install needed.
# We do need basic CA certs for HTTPS to R2/Supabase.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# pnpm needs the workspace YAML at install time to resolve --filter ./encoder.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY encoder/package.json ./encoder/

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --filter ./encoder

COPY encoder ./encoder

WORKDIR /app/encoder
CMD ["pnpm", "start"]
```

- [ ] **Step 6: Write `encoder/README.md`**

```markdown
# SynthCamp Encoder

Polls `claim_next_encode_job()` every 5 s, transcodes audio:
- `kind='full'`: HLS + AES-128, AAC 256 kbps, 6-second segments → `audio-stream/...`
- `kind='preview'`: MP3 128 kbps, 30 s starting at `tracks.preview_start_seconds` → `audio-preview/...`

## Environment

- `SUPABASE_URL` — e.g. `https://api.synthcamp.net`
- `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ENDPOINT` — `https://<account-id>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET` — **must match the Next.js side's `R2_BUCKET`** (default `synthcamp-audio-source` — yes the name is legacy from when only sources lived there; phase 3 reuses the same bucket with `audio-stream/` and `audio-preview/` prefixes added). No default in encoder; require explicit set.
- `POLL_INTERVAL_MS` — default `5000`
- `MAX_ATTEMPTS` — default `3`

## Local dev

```bash
cd encoder
pnpm install
cp .env.example .env  # fill secrets
pnpm dev
```

## Deploy

Railway service named `synthcamp-encoder`, root `encoder/`, build via Dockerfile.
```

- [ ] **Step 7: Install deps + typecheck the empty workspace**

```bash
pnpm install
cd encoder
pnpm typecheck
```

Expected: install succeeds, typecheck has nothing to type yet (no src files) → exits clean.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml encoder/
git commit -m "phase3(encoder): scaffold encoder workspace (package, tsconfig, Dockerfile)"
```

---

## Task 2: R2 client + storage helpers

**Files:**
- Create: `encoder/src/storage.ts`

- [ ] **Step 1: Write `encoder/src/storage.ts`**

```ts
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

const r2 = new S3Client({
  endpoint: required('R2_ENDPOINT'),
  region: 'auto',
  credentials: {
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  },
});

const bucket = required('R2_BUCKET');

/**
 * Download an R2 object to a local path. Streams via Node Readable to avoid
 * buffering the whole file in memory (audio sources can be 50+ MB).
 */
export async function downloadToFile(key: string, destPath: string): Promise<void> {
  const res = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`R2 object ${key} has no body`);
  const stream = res.Body as Readable;
  await pipeline(stream, createWriteStream(destPath));
}

/**
 * Multipart-aware upload from a local file or buffer. Used for HLS segments
 * and preview MP3. ContentType is required for browser playback (R2 returns
 * what we set; defaulting to octet-stream breaks <audio> on Safari).
 */
export async function uploadFile(args: {
  key: string;
  bodyPath?: string;
  bodyBuffer?: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<void> {
  if (!args.bodyPath && !args.bodyBuffer) {
    throw new Error('uploadFile requires either bodyPath or bodyBuffer');
  }
  // Lazy import only when needed (Node fs).
  const body = args.bodyBuffer ?? (await import('node:fs')).createReadStream(args.bodyPath!);
  const upload = new Upload({
    client: r2,
    params: {
      Bucket: bucket,
      Key: args.key,
      Body: body,
      ContentType: args.contentType,
      CacheControl: args.cacheControl,
    },
  });
  await upload.done();
}

/**
 * Best-effort delete. Used to clean up old segments when re-encoding.
 * Swallows NotFound — re-encoding a never-encoded track shouldn't error.
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchKey') return;
    throw err;
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd encoder && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add encoder/src/storage.ts
git commit -m "phase3(encoder): R2 storage helpers (download, upload, delete)"
```

---

## Task 3: Supabase service-role client

**Files:**
- Create: `encoder/src/db.ts`

- [ ] **Step 1: Write `encoder/src/db.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
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
```

- [ ] **Step 2: Typecheck**

```bash
cd encoder && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add encoder/src/db.ts
git commit -m "phase3(encoder): Supabase service-role client + job claim/mark/track helpers"
```

---

## Task 4: AES key generation

**Files:**
- Create: `encoder/src/key.ts`

- [ ] **Step 1: Write `encoder/src/key.ts`**

```ts
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
```

- [ ] **Step 2: Add a unit test**

Create `encoder/tests/key.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateAesKey, buildKeyInfoFile } from '../src/key';

describe('generateAesKey', () => {
  it('returns exactly 16 bytes', () => {
    expect(generateAesKey().length).toBe(16);
  });

  it('returns different keys on each call', () => {
    const a = generateAesKey().toString('hex');
    const b = generateAesKey().toString('hex');
    expect(a).not.toBe(b);
  });
});

describe('buildKeyInfoFile', () => {
  it('produces the 2-line format with placeholder URI', () => {
    const out = buildKeyInfoFile({ trackId: 'abc', localKeyPath: '/tmp/key.bin' });
    expect(out).toBe('https://synthcamp.net/api/tracks/abc/key\n/tmp/key.bin\n');
  });

  it('appends IV when provided', () => {
    const out = buildKeyInfoFile({
      trackId: 'abc',
      localKeyPath: '/tmp/key.bin',
      iv: '0123456789abcdef0123456789abcdef',
    });
    expect(out.split('\n')).toHaveLength(4);
    expect(out.split('\n')[2]).toBe('0123456789abcdef0123456789abcdef');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd encoder && pnpm test
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add encoder/src/key.ts encoder/tests/key.test.ts
git commit -m "phase3(encoder): AES-128 key generation + ffmpeg key info file builder"
```

---

## Task 5: Full HLS+AES encoder

**Files:**
- Create: `encoder/src/encode-full.ts`

- [ ] **Step 1: Write `encoder/src/encode-full.ts`**

```ts
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { mkdir, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
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
```

- [ ] **Step 2: Typecheck**

```bash
cd encoder && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add encoder/src/encode-full.ts
git commit -m "phase3(encoder): full HLS+AES-128 encoder via fluent-ffmpeg"
```

---

## Task 6: Preview MP3 encoder

**Files:**
- Create: `encoder/src/encode-preview.ts`

- [ ] **Step 1: Write `encoder/src/encode-preview.ts`**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
cd encoder && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add encoder/src/encode-preview.ts
git commit -m "phase3(encoder): preview MP3 encoder (30s slice from preview_start_seconds)"
```

---

## Task 7: Main loop / dispatcher

**Files:**
- Create: `encoder/src/index.ts`

- [ ] **Step 1: Write `encoder/src/index.ts`**

```ts
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
const PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;
if (!PUBLIC_BASE_URL) {
  throw new Error('R2_PUBLIC_BASE_URL is required (no fallback — set it explicitly in Railway vars)');
}

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
```

**Note on retry logic:** The plan's `claim_next_encode_job` RPC from Lot 1 increments `attempts` on each claim. After MAX_ATTEMPTS the job is marked failed terminally. A separate "re-enqueue stalled jobs" cron (out of scope for Lot 2) can re-pending failed jobs older than N hours if needed.

- [ ] **Step 2: Typecheck**

```bash
cd encoder && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add encoder/src/index.ts
git commit -m "phase3(encoder): main loop dispatcher with retry-bounded failure"
```

---

## Task 8: Local smoke test

**Files:**
- Create: `encoder/.env.example`
- Modify: `encoder/README.md` (add smoke test instructions)

- [ ] **Step 1: Write `encoder/.env.example`**

```dotenv
# Copy to .env locally, fill with real values, never commit.
SUPABASE_URL=https://api.synthcamp.net
SUPABASE_SERVICE_ROLE_KEY=

R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
# Must match Next.js R2_BUCKET (default `synthcamp-audio-source`).
R2_BUCKET=
# Public URL prefix for previews. Use the R2 public bucket URL or the CF
# custom-domain proxy. Required — no fallback.
R2_PUBLIC_BASE_URL=

POLL_INTERVAL_MS=5000
MAX_ATTEMPTS=3
```

- [ ] **Step 2: Smoke test instructions in README**

Append to `encoder/README.md`:

```markdown
## Smoke test (local)

1. Copy `.env.example` to `.env` and fill values from Railway / R2 / Supabase dashboards.
2. In another terminal, manually enqueue a test job against an existing track:

```sql
-- On the VPS:
docker exec -i supabase-db psql -U postgres -d postgres <<SQL
INSERT INTO public.encode_jobs (track_id, kind)
SELECT id, 'preview' FROM public.tracks WHERE audio_source_key IS NOT NULL LIMIT 1;
SQL
```

3. Run the encoder locally: `pnpm dev` (from `encoder/`).
4. Watch the logs:
   - "claimed job ... preview ..."
   - "preview encoded: https://..."
5. Verify R2 has the new `audio-preview/.../<track_id>.mp3` object.
6. Verify the track row: `SELECT preview_url FROM tracks WHERE id = '<track_id>';` is now set.
```

- [ ] **Step 3: Commit**

```bash
git add encoder/.env.example encoder/README.md
git commit -m "phase3(encoder): .env.example + smoke test instructions"
```

---

## Task 9: Railway service deploy doc

**Files:**
- Create: `docs/encoder-deploy.md`

- [ ] **Step 1: Write the doc**

```markdown
# Encoder Worker — Railway Deploy

The encoder is a separate Railway service in the same Railway project as
the Next.js app, deployed from the `encoder/` directory of this monorepo.

## One-time setup

1. **Cloudflare R2:**
   - Create a bucket named `synthcamp-audio` (or whatever).
   - Generate an R2 API token with read+write on that bucket. Save the
     access key ID, secret, and the account-scoped endpoint URL
     (`https://<account-id>.r2.cloudflarestorage.com`).
   - Make `audio-preview/*` publicly readable: in R2 settings, add a
     custom domain or enable the public-read setting for the prefix. The
     30-second MP3 previews need to be reachable by anonymous browsers.
   - Keep `audio-source/*`, `audio-stream/*`, and `key.bin` private.

2. **Railway service:**
   - In the SynthCamp project, click "+ New" → "Empty Service".
   - Name: `synthcamp-encoder`.
   - Source: GitHub repo, branch `main`, root directory `encoder/`.
   - Build: Dockerfile (auto-detected from `encoder/Dockerfile`).
   - Start command: empty (Dockerfile CMD handles it).

3. **Environment variables** (paste into Railway service Variables):
   - `SUPABASE_URL` = `https://api.synthcamp.net`
   - `SUPABASE_SERVICE_ROLE_KEY` = (copy from the Next.js service's vars)
   - `R2_ENDPOINT` = `https://<account-id>.r2.cloudflarestorage.com`
   - `R2_ACCESS_KEY_ID` = (from R2 token)
   - `R2_SECRET_ACCESS_KEY` = (from R2 token)
   - `R2_BUCKET` = `synthcamp-audio`
   - `R2_PUBLIC_BASE_URL` = (the public URL prefix; for default R2 public,
     this is the worker URL or a custom domain — confirm with one
     manual upload-then-fetch test)
   - `POLL_INTERVAL_MS` = `5000`
   - `MAX_ATTEMPTS` = `3`

4. **Deploy:** Railway auto-deploys on push to `main`. First deploy takes
   ~3 minutes (Docker build + pnpm install).

5. **Verify:** Logs should show:
   ```
   [encoder] starting, poll interval 5000ms
   ```
   followed by "claimed job ..." lines whenever a track is uploaded.

## Operational notes

- Failed encodes leave `tracks.encode_status='failed'`. The artist can retry from the wizard (Lot 5).
- The encoder is single-replica by default. If queue depth grows, scale
  to 2-3 replicas — the atomic claim RPC handles concurrency.
- Logs to monitor: any "FFmpeg ... failed" or "loop iteration error".
- **Cost:** R2 egress is free to Cloudflare network (player + Next.js
  fetches segments through CF). Pulling source from R2 to the encoder
  worker incurs egress only if Railway's egress IP isn't on Cloudflare's
  network — verify with one transfer.
```

- [ ] **Step 2: Commit**

```bash
git add docs/encoder-deploy.md
git commit -m "phase3(encoder): Railway deploy + R2 setup doc"
```

---

## Task 10: Push + deploy

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Manual on Railway (per `docs/encoder-deploy.md`)**

Create the service, paste env vars, wait for first deploy to go green.

- [ ] **Step 3: Smoke test in production**

On the VPS, enqueue a manual preview job for an existing track:

```bash
docker exec -i supabase-db psql -U postgres -d postgres <<SQL
INSERT INTO public.encode_jobs (track_id, kind)
SELECT id, 'preview' FROM public.tracks
  WHERE audio_source_key IS NOT NULL
  LIMIT 1;
SQL
```

Watch Railway logs for the encoder service. Expected:
1. Job claimed
2. Source downloaded
3. FFmpeg encodes
4. Preview uploaded to R2
5. `tracks.preview_url` updated

Then enqueue a `full` job and verify `playlist.m3u8` + segments in R2.

---

## Lot 2 done when:

- Encoder service deployed on Railway, logs healthy.
- One end-to-end smoke test (preview + full) processed successfully.
- `tracks.encode_status='ready'` on the smoke-tested track.
- All commits pushed to `origin/main`.

## What's NOT done yet (next lots):

- Stripe Checkout + Connect refresh + webhook (Lot 3)
- Manifest endpoint with per-request JWT signing + key endpoint (Lot 4)
- UI: artist preview controls + buy CTAs + library + payouts dashboard (Lot 5)
- E2E tests + ops dashboards (Lot 6)
