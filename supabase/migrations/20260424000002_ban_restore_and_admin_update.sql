-- SynthCamp — unban restores the artist's content, and admins gain the
-- ability to archive any release / cancel any scheduled party.
--
-- Ban now stashes each affected row's previous status in a pre_ban_status
-- column, so unban can revert precisely (instead of leaving things
-- archived forever).

ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS pre_ban_status release_status;

ALTER TABLE public.listening_parties
  ADD COLUMN IF NOT EXISTS pre_ban_status party_status;

-- Rewrite the ban RPC to preserve previous statuses.
CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.profiles
  SET banned_at = now(), banned_reason = p_reason
  WHERE id = p_user_id;

  -- Remember the prior status for non-archived releases, then archive them.
  UPDATE public.releases
  SET pre_ban_status = status, status = 'archived'
  WHERE artist_id = p_user_id
    AND status <> 'archived'
    AND pre_ban_status IS NULL;

  -- Same for scheduled/live parties — preserve prior state, then cancel.
  UPDATE public.listening_parties
  SET pre_ban_status = status, status = 'cancelled', updated_at = now()
  WHERE artist_id = p_user_id
    AND status IN ('scheduled', 'live')
    AND pre_ban_status IS NULL;
END;
$$;

-- Rewrite the unban RPC to restore the preserved statuses.
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.profiles
  SET banned_at = NULL, banned_reason = NULL
  WHERE id = p_user_id;

  -- Releases: revert to whatever they were before the ban.
  UPDATE public.releases
  SET status = pre_ban_status, pre_ban_status = NULL
  WHERE artist_id = p_user_id AND pre_ban_status IS NOT NULL;

  -- Parties: only restore still-in-the-future scheduled ones. A party that
  -- was live during the ban or whose scheduled_at has passed stays
  -- cancelled, but we clear the marker so a subsequent ban won't re-stash.
  UPDATE public.listening_parties
  SET status = pre_ban_status, pre_ban_status = NULL, updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status IS NOT NULL
    AND pre_ban_status = 'scheduled'
    AND scheduled_at > now();

  UPDATE public.listening_parties
  SET pre_ban_status = NULL
  WHERE artist_id = p_user_id AND pre_ban_status IS NOT NULL;
END;
$$;

-- Admin-only UPDATE policies so admins can archive/cancel any content
-- through the existing API routes (release archive + party cancel).
DROP POLICY IF EXISTS releases_update_admin ON public.releases;
CREATE POLICY releases_update_admin ON public.releases FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS listening_parties_update_admin ON public.listening_parties;
CREATE POLICY listening_parties_update_admin ON public.listening_parties FOR UPDATE
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Extend the existing cancel RPC: admins bypass ownership + the 1-hour
-- pre-party lockout.
CREATE OR REPLACE FUNCTION public.cancel_listening_party(p_party_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party record;
  v_is_admin boolean;
BEGIN
  SELECT * INTO v_party FROM public.listening_parties WHERE id = p_party_id;
  IF v_party IS NULL THEN
    RAISE EXCEPTION 'Party not found';
  END IF;

  v_is_admin := public.is_current_user_admin();

  IF v_party.artist_id <> auth.uid() AND NOT v_is_admin THEN
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

  UPDATE public.releases
  SET status = 'draft', release_date = NULL
  WHERE id = v_party.release_id;
END;
$$;
