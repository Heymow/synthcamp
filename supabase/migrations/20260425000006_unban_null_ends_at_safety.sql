-- SynthCamp — defensive: handle listening_parties rows where ends_at IS NULL
-- inside admin_unban_user.
--
-- Today the BEFORE INSERT/UPDATE trigger on listening_parties auto-computes
-- ends_at = scheduled_at + interval '1 hour' if it's left null, so in
-- practice every row in the wild has ends_at populated. But the 5-branch
-- UPDATE in 20260425000004_unban_restore_live.sql compares ends_at directly
-- in branches 2/3/4/5 — if a row ever slipped through with NULL ends_at
-- (e.g. a manual SQL edit, a future trigger drop, a botched data import),
-- those branches would silently skip it and the party would remain in
-- whatever wrong status the ban left it in.
--
-- Fix: re-define admin_unban_user with COALESCE(ends_at, scheduled_at +
-- interval '1 hour') wherever ends_at is compared. Same five-branch
-- semantics; the COALESCE only kicks in for the otherwise-unhandled NULL
-- case, which is exactly the 6th defensive branch the review called for.
--
-- Everything else (admin guard, profiles update, releases restore, marker
-- clear) is byte-identical to the prior migration.

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
  -- Every comparison against ends_at uses COALESCE(ends_at,
  -- scheduled_at + interval '1 hour') so a NULL ends_at falls back to
  -- the same one-hour window the BEFORE trigger would have computed.

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
    AND COALESCE(ends_at, scheduled_at + interval '1 hour') > now();

  -- 3) was live but its session has already elapsed -> ended.
  UPDATE public.listening_parties
  SET status = 'ended', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'live'
    AND COALESCE(ends_at, scheduled_at + interval '1 hour') <= now();

  -- 4) scheduled but start passed during ban (and still inside window) -> live.
  UPDATE public.listening_parties
  SET status = 'live', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'scheduled'
    AND scheduled_at <= now()
    AND COALESCE(ends_at, scheduled_at + interval '1 hour') > now();

  -- 5) scheduled and both start + end elapsed during ban -> ended.
  UPDATE public.listening_parties
  SET status = 'ended', updated_at = now()
  WHERE artist_id = p_user_id
    AND pre_ban_status = 'scheduled'
    AND COALESCE(ends_at, scheduled_at + interval '1 hour') <= now();

  -- Finally, clear the marker on every row this unban touched so the
  -- next ban cycle starts fresh.
  UPDATE public.listening_parties
  SET pre_ban_status = NULL
  WHERE artist_id = p_user_id AND pre_ban_status IS NOT NULL;
END;
$$;
