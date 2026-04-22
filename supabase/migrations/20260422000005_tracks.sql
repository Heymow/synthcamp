-- SynthCamp Phase 2 Migration 5 — tracks table + RLS

CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  track_number integer NOT NULL CHECK (track_number BETWEEN 1 AND 100),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  audio_source_key text,
  hls_manifest_key text,
  aes_key_id uuid,
  credit_category credit_category,
  credit_tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(release_id, track_number)
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tracks_select_via_release ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id
        AND (r.status IN ('published', 'unlisted', 'scheduled') OR r.artist_id = auth.uid())
    )
  );

CREATE POLICY tracks_insert_on_own_release ON public.tracks FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.artist_id = auth.uid())
  );

CREATE POLICY tracks_update_on_own_release ON public.tracks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.artist_id = auth.uid()));

CREATE POLICY tracks_delete_if_draft ON public.tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id
        AND r.artist_id = auth.uid()
        AND r.status = 'draft'
    )
  );

CREATE INDEX idx_tracks_release_number ON public.tracks(release_id, track_number);
