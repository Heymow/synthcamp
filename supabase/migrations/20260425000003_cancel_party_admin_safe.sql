-- SynthCamp — admin cancel of a listening party must not mutate the
-- artist's release row.
--
-- Previously cancel_listening_party always blanked release.release_date
-- and reset release.status='draft'. That's correct when the artist
-- cancels their own party (they intend to re-schedule), but destructive
-- when an admin cancels for moderation reasons — the artist suddenly
-- loses the date they had set.
--
-- New behavior: only the artist-self path touches the release; the admin
-- path cancels the party row only.

CREATE OR REPLACE FUNCTION public.cancel_listening_party(p_party_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party record;
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  SELECT * INTO v_party FROM public.listening_parties WHERE id = p_party_id;
  IF v_party IS NULL THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  v_is_admin := public.is_current_user_admin();
  v_is_owner := v_party.artist_id = auth.uid();

  IF NOT v_is_owner AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Not owner';
  END IF;

  IF v_party.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Party is not scheduled (current status: %)', v_party.status;
  END IF;

  IF NOT v_is_admin AND v_party.scheduled_at - interval '1 hour' < now() THEN
    RAISE EXCEPTION 'Cancel window closed (< 1h before start)';
  END IF;

  UPDATE public.listening_parties
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_party_id;

  -- Only reset the release when the artist cancels their own party.
  -- Admin cancellations leave the artist's release_date / status alone
  -- so the artist isn't surprised by silent data loss after moderation.
  IF v_is_owner THEN
    UPDATE public.releases
    SET status = 'draft', release_date = NULL
    WHERE id = v_party.release_id;
  END IF;
END;
$$;
