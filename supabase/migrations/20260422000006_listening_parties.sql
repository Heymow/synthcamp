-- SynthCamp Phase 2 Migration 6 — listening_parties table + overlap exclusion
--
-- Note: ends_at uses a BEFORE trigger instead of GENERATED because
-- scheduled_at + interval is not immutable (timezone-dependent),
-- which Postgres rejects in GENERATED STORED columns.

CREATE TABLE public.listening_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL UNIQUE REFERENCES public.releases(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL
    CHECK (extract(epoch from scheduled_at)::bigint % 900 = 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  ends_at timestamptz NOT NULL,
  status party_status NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(scheduled_at, ends_at) WITH &&
  ) WHERE (status IN ('scheduled', 'live'))
);

-- Compute ends_at via trigger (can't use GENERATED STORED because
-- timestamptz + interval is stable, not immutable)
CREATE FUNCTION public.compute_party_ends_at() RETURNS trigger AS $$
BEGIN
  NEW.ends_at := NEW.scheduled_at + make_interval(secs => NEW.duration_seconds);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parties_set_ends_at
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_seconds ON public.listening_parties
  FOR EACH ROW EXECUTE FUNCTION public.compute_party_ends_at();

ALTER TABLE public.listening_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY parties_select_public ON public.listening_parties FOR SELECT USING (true);

CREATE POLICY parties_insert_via_rpc ON public.listening_parties FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

CREATE POLICY parties_update_own ON public.listening_parties FOR UPDATE
  USING (auth.uid() = artist_id) WITH CHECK (auth.uid() = artist_id);

CREATE POLICY parties_no_delete ON public.listening_parties FOR DELETE USING (false);

CREATE INDEX idx_parties_room_status ON public.listening_parties(room_id, status, scheduled_at);
CREATE INDEX idx_parties_artist_status ON public.listening_parties(artist_id, status);
