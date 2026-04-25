-- SynthCamp Phase 3 — encode_jobs table + atomic claim RPC.
--
-- The encoder worker polls this every 5s. The RPC performs SELECT … FOR
-- UPDATE SKIP LOCKED + UPDATE in a single SECURITY DEFINER call, so two
-- concurrent workers never claim the same job. Worker calls the RPC via
-- service-role client; no direct INSERT/SELECT permissions are granted.

CREATE TABLE IF NOT EXISTS public.encode_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('full', 'preview')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_encode_jobs_pending
  ON public.encode_jobs (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_encode_jobs_track
  ON public.encode_jobs (track_id, kind, status);

ALTER TABLE public.encode_jobs ENABLE ROW LEVEL SECURITY;
-- No policies. Service-role bypasses RLS; everyone else sees nothing.

-- Atomic claim. Returns the claimed row's id + track_id + kind so the worker
-- can fetch the track row separately if it needs the audio_source_key, etc.
CREATE OR REPLACE FUNCTION public.claim_next_encode_job()
RETURNS TABLE (
  job_id uuid,
  track_id uuid,
  kind text,
  attempts int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed record;
BEGIN
  UPDATE public.encode_jobs ej
  SET status = 'running',
      claimed_at = now(),
      attempts = ej.attempts + 1
  WHERE ej.id = (
    SELECT id FROM public.encode_jobs
    WHERE status = 'pending'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING ej.id, ej.track_id, ej.kind, ej.attempts INTO claimed;

  IF FOUND THEN
    RETURN QUERY SELECT claimed.id, claimed.track_id, claimed.kind, claimed.attempts;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_encode_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_encode_job() TO service_role;

-- Helper to mark a job done. Service-role only.
CREATE OR REPLACE FUNCTION public.mark_encode_job_done(
  p_job_id uuid,
  p_status text,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('succeeded', 'failed') THEN
    RAISE EXCEPTION 'Invalid terminal status: %', p_status;
  END IF;
  UPDATE public.encode_jobs
  SET status = p_status,
      last_error = p_error,
      finished_at = now()
  WHERE id = p_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_encode_job_done(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_encode_job_done(uuid, text, text) TO service_role;
