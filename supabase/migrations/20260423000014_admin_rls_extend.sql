-- SynthCamp — let admins read every release/track regardless of status, so
-- the moderation dashboard can display archived content, inspect reports
-- pointing at archived releases, etc. Profiles already public; parties
-- already public.

DROP POLICY IF EXISTS releases_select_admin ON public.releases;
CREATE POLICY releases_select_admin ON public.releases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS tracks_select_admin ON public.tracks;
CREATE POLICY tracks_select_admin ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
