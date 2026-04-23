-- SynthCamp — admin ban flow.
-- A banned user:
--   * can still sign in (to retrieve pending payouts in phase 3+)
--   * is hidden from other users (profiles RLS)
--   * has every release archived and every scheduled/live party cancelled
--
-- Unbanning lifts the flag but does NOT restore releases or parties — the
-- artist has to republish if they want them back.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_banned_at
  ON public.profiles(banned_at)
  WHERE banned_at IS NOT NULL;

-- SECURITY DEFINER helper so RLS on profiles doesn't recurse when we check
-- "am I admin" from inside another profiles policy.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, anon;

-- Hide banned profiles from everyone except the banned user themselves and
-- admins. This cascades: any FK join on profiles from a logged-out viewer
-- returns empty for a banned artist.
DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
CREATE POLICY profiles_select_public ON public.profiles FOR SELECT
  USING (
    banned_at IS NULL
    OR auth.uid() = id
    OR public.is_current_user_admin()
  );

-- The ban action itself. Admin-only; archives releases + cancels active
-- parties in a single transaction.
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

  UPDATE public.releases
  SET status = 'archived'
  WHERE artist_id = p_user_id AND status <> 'archived';

  UPDATE public.listening_parties
  SET status = 'cancelled', updated_at = now()
  WHERE artist_id = p_user_id AND status IN ('scheduled', 'live');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;

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
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;
