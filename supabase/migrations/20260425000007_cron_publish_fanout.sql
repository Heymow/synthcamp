-- SynthCamp — fan out follower notifications from the auto-publish cron.
--
-- The original cron_publish_future_releases (20260422000015) flipped
-- scheduled -> published in a single SQL UPDATE and never called
-- fanout_release_notification. Followers of an artist who scheduled a
-- future release therefore never got the in-app notif (email was not
-- wired into the cron yet either, but that's a separate piece).
--
-- Replace the function with a PL/pgSQL loop that collects the published
-- IDs in a CTE and fires fanout_release_notification per row. The cron
-- schedule from the original migration (every minute) stays as-is — we
-- only replace the function body.

CREATE OR REPLACE FUNCTION public.cron_publish_future_releases()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    WITH flipped AS (
      UPDATE public.releases r
      SET status = 'published', updated_at = now()
      WHERE r.status = 'scheduled'
        AND r.release_date IS NOT NULL
        AND r.release_date <= now()
        AND NOT EXISTS (
          SELECT 1 FROM public.listening_parties p
          WHERE p.release_id = r.id
            AND p.status NOT IN ('cancelled', 'ended')
        )
      RETURNING r.id
    )
    SELECT id FROM flipped
  LOOP
    PERFORM public.fanout_release_notification(v_id);
  END LOOP;
END;
$$;
