-- SynthCamp — finalize ended listening parties.
--
-- Investigation (2026-04-25): no existing cron or trigger flips parties
-- from 'live' -> 'ended' in the normal lifecycle. The only writes of
-- 'ended' are in unban-restore paths for admin ban recovery
-- (20260425000004, 20260425000006). Meanwhile cron_publish_future_releases
-- explicitly SKIPS releases with an active party (NOT IN
-- ('cancelled', 'ended')), so a scheduled release tied to a party waits
-- for the party to end before it can ever publish — except the party
-- never ends, so the release never publishes and followers never get
-- their release_published notification or email.
--
-- This cron does the full finalization in one pass:
--   1. Parties with status='live' AND ends_at < now() -> 'ended'.
--      (Also handle 'scheduled' parties that were never flipped to
--      live — ends_at < now() means the whole window has passed.)
--   2. For each release tied to a just-ended party, if
--      status='scheduled', flip to 'published', set release_date=now(),
--      and call fanout_release_notification.
--
-- Idempotency: the finalize loop only processes parties that are
-- currently live/scheduled and whose ends_at has passed. Once flipped
-- to 'ended' they won't match again. The release fanout only fires
-- when the release is still 'scheduled' at the moment we flip it, so
-- a second cron tick finds nothing to fan out. fanout_release_notification
-- itself does a single INSERT ... SELECT keyed on the current follower
-- set; we scope to 'scheduled' -> 'published' so it runs exactly once
-- per party per release.

CREATE OR REPLACE FUNCTION public.cron_finalize_ended_parties()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release_id uuid;
BEGIN
  -- Step 1: flip expired parties to 'ended' and, for each one whose
  -- release is still 'scheduled', atomically flip the release to
  -- 'published'. Returning the release ids we actually flipped to
  -- 'published' keeps fan-out idempotent — a re-run finds nothing.
  FOR v_release_id IN
    WITH ended_parties AS (
      UPDATE public.listening_parties
      SET status = 'ended', updated_at = now()
      WHERE status IN ('live', 'scheduled')
        AND ends_at IS NOT NULL
        AND ends_at < now()
      RETURNING release_id
    ),
    published_releases AS (
      UPDATE public.releases r
      SET status = 'published',
          release_date = now(),
          updated_at = now()
      WHERE r.id IN (SELECT release_id FROM ended_parties)
        AND r.status = 'scheduled'
      RETURNING r.id
    )
    SELECT id FROM published_releases
  LOOP
    PERFORM public.fanout_release_notification(v_release_id);
  END LOOP;
END;
$$;

-- Schedule every minute, mirroring cron_publish_future_releases.
SELECT cron.schedule(
  'finalize-ended-parties',
  '* * * * *',
  $$SELECT public.cron_finalize_ended_parties();$$
);
