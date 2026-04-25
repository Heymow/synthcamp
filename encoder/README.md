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
