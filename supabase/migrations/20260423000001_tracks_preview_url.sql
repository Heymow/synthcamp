-- SynthCamp — add preview_url to tracks for Phase 2 demo audio.
-- Phase 3 will introduce HLS+AES DRM as audio_source_key / hls_manifest_key,
-- and preview_url will either be reused as "30-second public preview" or
-- removed. For now: an optional absolute URL the mini-player streams directly.

ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS preview_url text;
