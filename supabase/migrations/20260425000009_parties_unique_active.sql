-- SynthCamp — partial unique indexes to close the TOCTOU holes in
-- validate_and_create_listening_party.
--
-- The RPC (20260422000013) does SELECT-then-INSERT for two uniqueness
-- rules:
--   1. "1 active party (scheduled|live) per artist"
--   2. "1 GMC party per artist per calendar month"
-- Two concurrent calls can both pass the SELECT and both INSERT. The
-- app-level check stays as a fast friendly-error path; these indexes
-- are the atomic guarantee underneath.
--
-- Rule #2 uses room_kind in the predicate. Postgres only allows
-- IMMUTABLE expressions in partial-index predicates, so we can't put a
-- subquery against rooms there. We denormalize room_kind onto
-- listening_parties (populated by a BEFORE trigger) and index on that.

-- 1. Denormalize rooms.kind onto listening_parties.
--
-- Add nullable first, backfill from the join, then SET NOT NULL so
-- existing rows don't trip the constraint.
ALTER TABLE public.listening_parties
  ADD COLUMN IF NOT EXISTS room_kind public.room_kind;

UPDATE public.listening_parties lp
SET room_kind = r.kind
FROM public.rooms r
WHERE r.id = lp.room_id
  AND lp.room_kind IS NULL;

ALTER TABLE public.listening_parties
  ALTER COLUMN room_kind SET NOT NULL;

-- 2. Trigger to keep room_kind in sync on insert/update. Fires BEFORE
-- so the value is set before any constraint/index check.
CREATE OR REPLACE FUNCTION public.listening_parties_set_room_kind()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT kind INTO NEW.room_kind FROM public.rooms WHERE id = NEW.room_id;
  IF NEW.room_kind IS NULL THEN
    RAISE EXCEPTION 'Room % not found', NEW.room_id USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listening_parties_set_room_kind ON public.listening_parties;
CREATE TRIGGER trg_listening_parties_set_room_kind
  BEFORE INSERT OR UPDATE OF room_id ON public.listening_parties
  FOR EACH ROW EXECUTE FUNCTION public.listening_parties_set_room_kind();

-- 3. Partial unique index: 1 active party per artist.
--
-- Index creation aborts if existing rows violate; we do NOT auto-clean
-- duplicates — an artist with 2+ scheduled/live parties is a data bug
-- that warrants manual review.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_one_active_per_artist
  ON public.listening_parties (artist_id)
  WHERE status IN ('scheduled', 'live');

-- 4. Partial unique index: 1 GMC party per artist per calendar month.
--
-- The 2-arg date_trunc('month', timestamptz) is STABLE (session-TZ
-- dependent) and Postgres rejects STABLE expressions in index
-- definitions. The 3-arg form date_trunc('month', timestamptz, 'UTC')
-- is IMMUTABLE in PG 12+ — pinning the timezone explicitly to UTC makes
-- the result deterministic regardless of session settings.
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_gmc_one_per_month_per_artist
  ON public.listening_parties (artist_id, date_trunc('month', scheduled_at, 'UTC'))
  WHERE status <> 'cancelled' AND room_kind = 'global_master';
