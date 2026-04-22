-- SynthCamp Phase 2 Migration 12 — validate_release_publish RPC

CREATE FUNCTION public.validate_release_publish(p_release_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_artist_id uuid;
  v_track_count integer;
  v_missing_audio integer;
  v_releases_this_month integer;
BEGIN
  SELECT artist_id INTO v_artist_id FROM public.releases WHERE id = p_release_id;
  IF v_artist_id IS NULL OR v_artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Release not found or not owned' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_track_count FROM public.tracks WHERE release_id = p_release_id;
  IF v_track_count < 3 THEN
    RAISE EXCEPTION 'Minimum 3 tracks required (found %)', v_track_count USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO v_missing_audio FROM public.tracks
  WHERE release_id = p_release_id AND audio_source_key IS NULL;
  IF v_missing_audio > 0 THEN
    RAISE EXCEPTION 'All tracks must have audio uploaded (% missing)', v_missing_audio USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO v_releases_this_month FROM public.releases
  WHERE artist_id = v_artist_id
    AND status IN ('scheduled', 'published', 'unlisted')
    AND release_date IS NOT NULL
    AND date_trunc('month', release_date) = date_trunc('month', now())
    AND id <> p_release_id;
  IF v_releases_this_month >= 2 THEN
    RAISE EXCEPTION 'Monthly release limit reached (2 per calendar month)' USING ERRCODE = '23514';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_release_publish(uuid) TO authenticated;
