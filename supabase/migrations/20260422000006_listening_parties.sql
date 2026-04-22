-- SynthCamp Phase 2 Migration 6 — listening_parties table + overlap exclusion

CREATE TABLE public.listening_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL UNIQUE REFERENCES public.releases(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL
    CHECK (extract(epoch from scheduled_at)::bigint % 900 = 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  ends_at timestamptz GENERATED ALWAYS AS
    (scheduled_at + make_interval(secs => duration_seconds)) STORED,
  status party_status NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(scheduled_at, ends_at) WITH &&
  ) WHERE (status IN ('scheduled', 'live'))
);

ALTER TABLE public.listening_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY parties_select_public ON public.listening_parties FOR SELECT USING (true);

CREATE POLICY parties_insert_via_rpc ON public.listening_parties FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

CREATE POLICY parties_update_own ON public.listening_parties FOR UPDATE
  USING (auth.uid() = artist_id) WITH CHECK (auth.uid() = artist_id);

CREATE POLICY parties_no_delete ON public.listening_parties FOR DELETE USING (false);

CREATE INDEX idx_parties_room_status ON public.listening_parties(room_id, status, scheduled_at);
CREATE INDEX idx_parties_artist_status ON public.listening_parties(artist_id, status);
