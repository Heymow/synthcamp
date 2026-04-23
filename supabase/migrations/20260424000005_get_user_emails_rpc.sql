-- SynthCamp — service-role helper: return emails for a given set of user IDs.
-- Self-hosted GoTrue's admin.getUserById is unreliable through the Supabase
-- gateway, so we read auth.users directly via a SECURITY DEFINER function
-- that only the service_role can execute.

CREATE OR REPLACE FUNCTION public.get_user_emails(p_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION public.get_user_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO service_role;
