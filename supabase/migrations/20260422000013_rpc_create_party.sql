-- SynthCamp Phase 2 Migration 13 — validate_and_create_listening_party RPC (all rate limits)

CREATE FUNCTION public.validate_and_create_listening_party(
  p_release_id uuid,
  p_room_id uuid,
  p_scheduled_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_artist_id uuid;
  v_release_status release_status;
  v_duration integer;
  v_room_kind room_kind;
  v_party_id uuid;
BEGIN
  SELECT artist_id, status INTO v_artist_id, v_release_status
  FROM public.releases WHERE id = p_release_id;

  IF v_artist_id IS NULL OR v_artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Release not found or not owned';
  END IF;

  IF v_release_status <> 'draft' THEN
    RAISE EXCEPTION 'Party scheduling only at publish time (release must be in draft status)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.listening_parties
    WHERE artist_id = v_artist_id AND status IN ('scheduled', 'live')
  ) THEN
    RAISE EXCEPTION 'Artist already has an active party';
  END IF;

  SELECT kind INTO v_room_kind FROM public.rooms WHERE id = p_room_id;
  IF v_room_kind IS NULL THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room_kind = 'global_master' THEN
    IF EXISTS (
      SELECT 1 FROM public.listening_parties p
      JOIN public.rooms r ON r.id = p.room_id
      WHERE p.artist_id = v_artist_id
        AND r.kind = 'global_master'
        AND p.status <> 'cancelled'
        AND date_trunc('month', p.scheduled_at) = date_trunc('month', p_scheduled_at)
    ) THEN
      RAISE EXCEPTION 'GMC limit reached for this calendar month';
    END IF;
  END IF;

  IF p_scheduled_at > now() + interval '3 months' THEN
    RAISE EXCEPTION 'Cannot schedule more than 3 months ahead';
  END IF;

  IF p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Cannot schedule in the past';
  END IF;

  SELECT COALESCE(SUM(duration_seconds), 0) INTO v_duration
  FROM public.tracks WHERE release_id = p_release_id;
  IF v_duration <= 0 THEN
    RAISE EXCEPTION 'Release has no tracks';
  END IF;

  INSERT INTO public.listening_parties (release_id, artist_id, room_id, scheduled_at, duration_seconds)
  VALUES (p_release_id, v_artist_id, p_room_id, p_scheduled_at, v_duration)
  RETURNING id INTO v_party_id;

  UPDATE public.releases SET status = 'scheduled', release_date = p_scheduled_at
  WHERE id = p_release_id;

  RETURN v_party_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_and_create_listening_party(uuid, uuid, timestamptz) TO authenticated;
