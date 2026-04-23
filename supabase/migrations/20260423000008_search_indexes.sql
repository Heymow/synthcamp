-- SynthCamp — search acceleration: trigram indexes for fast ILIKE, GIN
-- index on release genres for multi-select overlap queries.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_releases_title_trgm
  ON public.releases USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_releases_genres
  ON public.releases USING gin (genres);

CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON public.profiles USING gin (display_name gin_trgm_ops);
