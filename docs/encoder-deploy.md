# Encoder Worker — Railway Deploy

The encoder is a separate Railway service in the same Railway project as
the Next.js app, deployed from the `encoder/` directory of this monorepo.

## One-time setup

1. **Cloudflare R2:**
   - Use the existing R2 bucket the Next.js app already writes to (default `synthcamp-audio-source` per `lib/r2.ts`). Phase 3 adds new prefixes (`audio-stream/`, `audio-preview/`) to the same bucket — no new bucket needed.
   - Generate an R2 API token with read+write on that bucket. Save the
     access key ID, secret, and the account-scoped endpoint URL
     (`https://<account-id>.r2.cloudflarestorage.com`).
   - Make `audio-preview/*` publicly readable: in R2 settings, add a
     custom domain or enable the public-read setting for the prefix. The
     30-second MP3 previews need to be reachable by anonymous browsers.
   - Keep source uploads (top-level `artist_<uid>/...` keys), `audio-stream/*`, and `key.bin` private.

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
   - `R2_BUCKET` = exact same value as the Next.js service's `R2_BUCKET` (default `synthcamp-audio-source`)
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
