-- SynthCamp — defend notify_admins_of_report against direct-call abuse.
--
-- Problem: the previous migration GRANTed EXECUTE on this RPC to
-- `authenticated`, so any signed-in user could call it with any report id
-- and spam every admin with a notification row. The function is only meant
-- to be invoked from app/api/reports/route.ts immediately after a fresh
-- insert, on behalf of the reporter herself.
--
-- Defense in depth:
--   1. REVOKE the broad grant first (so a re-run of just this revoke is safe).
--   2. Re-define the function with two in-body guards:
--        a. auth.uid() must equal the report's reporter_id, so even if
--           someone re-grants access the RPC only fans out for one's own
--           report.
--        b. dedupe by checking notifications.payload->>'report_id' — if
--           a row already exists for any admin with this report_id, skip
--           the insert entirely (single fan-out per report, ever).
--   3. Re-GRANT EXECUTE to `authenticated` so the existing route call still
--      works through PostgREST RPC.

REVOKE EXECUTE ON FUNCTION public.notify_admins_of_report(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins_of_report(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_admins_of_report(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.notify_admins_of_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_id uuid;
  v_caller uuid := auth.uid();
  v_already_notified boolean;
BEGIN
  -- Guard 1: caller must be the reporter on the referenced report.
  SELECT reporter_id INTO v_reporter_id
  FROM public.reports
  WHERE id = p_report_id;

  IF v_reporter_id IS NULL THEN
    -- Report doesn't exist; silently no-op so callers can't probe IDs.
    RETURN;
  END IF;

  IF v_caller IS NULL OR v_caller <> v_reporter_id THEN
    RAISE EXCEPTION 'Not authorized to notify admins of this report'
      USING ERRCODE = '42501';
  END IF;

  -- Guard 2: dedupe — if any admin already has a notification for this
  -- report id, skip the fan-out so retries / replays don't multiply.
  SELECT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE kind = 'report_created'::notification_kind
      AND payload->>'report_id' = p_report_id::text
  ) INTO v_already_notified;

  IF v_already_notified THEN
    RETURN;
  END IF;

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

-- Re-grant: the in-function check is what protects, not the grant.
GRANT EXECUTE ON FUNCTION public.notify_admins_of_report(uuid) TO authenticated;
