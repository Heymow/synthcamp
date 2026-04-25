-- SynthCamp — unban restores parties that were live at ban time too.
--
-- The previous admin_unban_user only restored rows whose pre_ban_status
-- was 'scheduled' AND scheduled_at was still in the future. Live parties
-- (banned mid-stream) were silently dropped by the trailing clear.
--
-- New behavior: every party with pre_ban_status set is reconciled
-- against wall-clock time at unban:
--   1. pre_ban_status='scheduled' AND scheduled_at > now()
--        -> 'scheduled'  (still upcoming; restore as-was)
--   2. pre_ban_status='live'      AND ends_at      > now()
--        -> 'live'       (still within its session window; resume)
--   3. pre_ban_status='live'      AND ends_at     <= now()
--        -> 'ended'      (the session elapsed during the ban)
--   4. pre_ban_status='scheduled' AND scheduled_at <= now() AND ends_at > now()
--        -> 'live'       (start passed during ban; it should be live now)
--   5. pre_ban_status='scheduled' AND ends_at     <= now()
--        -> 'ended'      (both start and end elapsed during ban)
-- After the branches, every row touched by this unban has
-- pre_ban_status cleared so a subsequent ban won't double-stash.
--
-- Releases restore is unchanged from the prior migration.

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

  -- Parties: branch on (pre_ban_status, scheduled_at, ends_at, now()).

  -- 1) scheduled and still upcoming -> restore as scheduled.
  UPDATE public.listening_parties
  SET status = 'scheduled', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'scheduled'
    AND scheduled_at > now();

  -- 2) was live and still inside the session window -> resume as live.
  UPDATE public.listening_parties
  SET status = 'live', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'live'
    AND ends_at > now();

  -- 3) was live but its session has already elapsed -> ended.
  UPDATE public.listening_parties
  SET status = 'ended', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'live'
    AND ends_at <= now();

  -- 4) scheduled but start passed during ban (and still inside window) -> live.
  UPDATE public.listening_parties
  SET status = 'live', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'scheduled'
    AND scheduled_at <= now()
    AND ends_at > now();

  -- 5) scheduled and both start + end elapsed during ban -> ended.
  UPDATE public.listening_parties
  SET status = 'ended', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'scheduled'
    AND ends_at <= now();

  -- Finally, clear the marker on every row this unban touched so the
  -- next ban cycle starts fresh.
  UPDATE public.listening_parties
  SET pre_ban_status = NULL
  WHERE artist_id = p_user_id AND pre_ban_status IS NOT NULL;
END;
$$;
