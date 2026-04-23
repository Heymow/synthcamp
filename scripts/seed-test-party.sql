-- SynthCamp — reschedule a seeded listening party to ~25 min from now for
-- cron reminder testing. Picks a random scheduled party owned by a
-- 'seed-*' artist, updates scheduled_at to the next free 15-min slot in
-- its current room, clears reminder_sent_at so the cron will re-fire.
--
-- Run on the VPS:
--   docker exec -i supabase-db psql -U postgres -d postgres \
--     < /opt/synthcamp/scripts/seed-test-party.sql

DO $$
DECLARE
  v_party_id uuid;
  v_room_id uuid;
  v_scheduled timestamptz;
BEGIN
  SELECT lp.id, lp.room_id INTO v_party_id, v_room_id
  FROM listening_parties lp
  JOIN profiles p ON p.id = lp.artist_id
  WHERE p.slug LIKE 'seed-%'
    AND lp.status = 'scheduled'
  ORDER BY random()
  LIMIT 1;

  IF v_party_id IS NULL THEN
    RAISE EXCEPTION 'No scheduled seed party found';
  END IF;

  v_scheduled := date_trunc('hour', now())
               + (floor(extract(minute FROM now()) / 15) + 2) * interval '15 minutes';

  WHILE EXISTS (
    SELECT 1 FROM listening_parties
    WHERE room_id = v_room_id
      AND scheduled_at = v_scheduled
      AND status IN ('scheduled','live')
      AND id <> v_party_id
  ) LOOP
    v_scheduled := v_scheduled + interval '15 minutes';
  END LOOP;

  UPDATE listening_parties
  SET scheduled_at = v_scheduled,
      ends_at = v_scheduled + (duration_seconds || ' seconds')::interval,
      reminder_sent_at = NULL,
      updated_at = now()
  WHERE id = v_party_id;

  RAISE NOTICE 'Party % rescheduled at % UTC', v_party_id, v_scheduled;
END $$;
