-- SynthCamp — atomic claim helper for the party-reminders cron.
--
-- Problem: the cron endpoint used to SELECT due parties, then for each one
-- send notifications + emails, then UPDATE reminder_sent_at. Two overlapping
-- cron ticks (the scheduler hits us every 2-5 min) could both SELECT the
-- same row before either UPDATE landed, causing duplicate notifications and
-- duplicate emails for the same party.
--
-- Fix: claim the rows in a single atomic UPDATE…RETURNING and only do the
-- downstream work for rows we successfully claimed. Wrapped in a SECURITY
-- DEFINER function so the service-role client gets a single round-trip and
-- so the update is uniformly authorised regardless of any future RLS on
-- listening_parties.

CREATE OR REPLACE FUNCTION public.claim_party_reminders(p_window_minutes int DEFAULT 30)
RETURNS TABLE (
  party_id uuid,
  scheduled_at timestamptz,
  release_title text,
  artist_name text,
  room_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.listening_parties lp
    SET reminder_sent_at = now()
    WHERE lp.status = 'scheduled'
      AND lp.reminder_sent_at IS NULL
      AND lp.scheduled_at >= now()
      AND lp.scheduled_at <= now() + (p_window_minutes::text || ' minutes')::interval
    RETURNING lp.id, lp.scheduled_at, lp.release_id, lp.room_id
  )
  SELECT
    c.id,
    c.scheduled_at,
    r.title,
    p.display_name,
    rm.name
  FROM claimed c
  JOIN public.releases r ON r.id = c.release_id
  LEFT JOIN public.profiles p ON p.id = r.artist_id
  LEFT JOIN public.rooms rm ON rm.id = c.room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_party_reminders(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_party_reminders(int) TO service_role;
