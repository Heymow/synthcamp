-- SynthCamp Phase 2 Migration 4 — releases table + RLS + indexes

CREATE TABLE public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{1,120}$'),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  cover_url text NOT NULL,
  language text CHECK (language IS NULL OR char_length(language) = 2),
  genres text[] NOT NULL DEFAULT '{}' CHECK (array_length(genres, 1) IS NULL OR array_length(genres, 1) <= 5),
  price_minimum numeric(10,2) NOT NULL CHECK (price_minimum >= 0),
  credit_category credit_category NOT NULL,
  credit_tags text[] NOT NULL DEFAULT '{}',
  credit_narrative text CHECK (credit_narrative IS NULL OR char_length(credit_narrative) <= 280),
  credits_per_track boolean NOT NULL DEFAULT false,
  verification_status credit_verification_status NOT NULL DEFAULT 'declared',
  release_date timestamptz,
  status release_status NOT NULL DEFAULT 'draft',
  is_listed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY releases_select_public ON public.releases FOR SELECT
  USING (
    status IN ('published', 'unlisted', 'scheduled')
    OR auth.uid() = artist_id
  );

CREATE POLICY releases_insert_own ON public.releases FOR INSERT
  WITH CHECK (auth.uid() = artist_id);

CREATE POLICY releases_update_own ON public.releases FOR UPDATE
  USING (auth.uid() = artist_id) WITH CHECK (auth.uid() = artist_id);

CREATE POLICY releases_no_delete ON public.releases FOR DELETE USING (false);

CREATE INDEX idx_releases_artist_status ON public.releases(artist_id, status);
CREATE INDEX idx_releases_status_listed_created ON public.releases(status, is_listed, created_at DESC)
  WHERE status = 'published' AND is_listed = true;
