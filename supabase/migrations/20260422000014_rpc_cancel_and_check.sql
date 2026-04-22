-- SynthCamp Phase 2 Migration 14 — cancel_listening_party + check_release_editable RPCs

CREATE FUNCTION public.cancel_listening_party(p_party_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_party record;
BEGIN
  SELECT * INTO v_party FROM public.listening_parties WHERE id = p_party_id;

  IF v_party IS NULL THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  IF v_party.artist_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not owner';
  END IF;

  IF v_party.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Party is not scheduled (current status: %)', v_party.status;
  END IF;

  IF v_party.scheduled_at - interval '1 hour' < now() THEN
    RAISE EXCEPTION 'Cancel window closed (< 1h before start)';
  END IF;

  UPDATE public.listening_parties SET status = 'cancelled', updated_at = now()
  WHERE id = p_party_id;

  UPDATE public.releases SET status = 'draft', release_date = NULL
  WHERE id = v_party.release_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_listening_party(uuid) TO authenticated;

CREATE FUNCTION public.check_release_editable(p_release_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.listening_parties
    WHERE release_id = p_release_id
      AND status IN ('scheduled', 'live')
      AND (scheduled_at - interval '24 hours') < now()
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_release_editable(uuid) TO authenticated;
