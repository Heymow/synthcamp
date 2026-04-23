-- SynthCamp — plays counter on tracks. Phase 2 stores a single aggregate;
-- phase 4+ may split into a plays event table for time-series analytics.

ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS plays_count bigint NOT NULL DEFAULT 0;

-- Atomic increment via RPC so anonymous and authenticated clients alike can
-- bump the counter without needing a direct UPDATE privilege on tracks.
CREATE OR REPLACE FUNCTION public.increment_track_play(p_track_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only count plays on publicly accessible releases to avoid counting drafts.
  UPDATE public.tracks t
  SET plays_count = plays_count + 1
  WHERE t.id = p_track_id
    AND EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = t.release_id
        AND r.status IN ('published', 'unlisted', 'scheduled')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_track_play(uuid) TO anon, authenticated;
