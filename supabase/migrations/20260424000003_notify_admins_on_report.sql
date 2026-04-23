-- SynthCamp — in-app notification to every admin when a report is filed.

-- Postgres needs an explicit commit between ADD VALUE and the function that
-- references the new value, so we split the enum change into its own
-- statement that is a no-op on rerun.
ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'report_created';

-- SECURITY DEFINER so a regular user submitting a report can still trigger
-- the fan-out (they don't have INSERT privilege on admins' notifications
-- rows under RLS).
CREATE OR REPLACE FUNCTION public.notify_admins_of_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, payload)
  SELECT
    p.id,
    'report_created'::notification_kind,
    jsonb_build_object(
      'report_id', r.id,
      'target_type', r.target_type::text,
      'target_id', r.target_id,
      'reason', left(r.reason, 120),
      'reporter_id', r.reporter_id
    )
  FROM public.profiles p
  CROSS JOIN public.reports r
  WHERE p.is_admin = true
    AND r.id = p_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admins_of_report(uuid) TO authenticated;
