-- SynthCamp Phase 3 — DRM/preview columns on tracks + party-live discount on releases.

ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS preview_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preview_start_seconds int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS encode_status text NOT NULL DEFAULT 'pending'
    CHECK (encode_status IN ('pending', 'encoding', 'ready', 'failed'));

-- Backfill: tracks that already have hls_manifest_key set (phase 2 uploads
-- that completed encoding through any prior pipeline) start in 'ready'.
-- Today this matches zero rows in production (the upload route never wrote
-- hls_manifest_key), but the UPDATE is harmless and protects against any
-- future state we haven't anticipated.
UPDATE public.tracks
SET encode_status = 'ready'
WHERE hls_manifest_key IS NOT NULL;

-- Disable preview on any track shorter than 30 seconds before adding the
-- CHECK. Without this, the constraint would reject the migration on
-- short tracks (preview_start_seconds=0 + 30 > duration_seconds<30).
UPDATE public.tracks
SET preview_enabled = false
WHERE duration_seconds < 30;

-- Constraint: either preview is disabled, OR the 30s window fits within
-- the track. CREATE CONSTRAINT has no IF NOT EXISTS, so guard with DO.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_constraint WHERE conname = 'preview_window_in_bounds'
  ) THEN
    ALTER TABLE public.tracks
      ADD CONSTRAINT preview_window_in_bounds
        CHECK (preview_enabled = false OR preview_start_seconds + 30 <= duration_seconds);
  END IF;
END $$;

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS party_live_discount_pct int NOT NULL DEFAULT 20
    CHECK (party_live_discount_pct BETWEEN 0 AND 50);
