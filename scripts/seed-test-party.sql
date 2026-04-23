-- SynthCamp — seed a near-future listening party for cron reminder testing.
-- Picks a random published release from a seeded dummy artist, finds the
-- next free 15-min slot in GMC starting ~25 min from now, and schedules
-- a 15-min party. Idempotent in the sense that it won't clobber an
-- existing party at the same slot.
--
-- Run on the VPS:
--   docker exec -i supabase-db psql -U postgres -d postgres \
--     < /opt/synthcamp/scripts/seed-test-party.sql

DO $$
DECLARE
  v_release_id uuid;
  v_artist_id uuid;
  v_room_id uuid;
  v_scheduled timestamptz;
  v_party_id uuid;
BEGIN
  SELECT r.id, r.artist_id INTO v_release_id, v_artist_id
  FROM releases r
  JOIN profiles p ON p.id = r.artist_id
  WHERE p.slug LIKE 'seed-%'
    AND r.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM listening_parties lp
      WHERE lp.release_id = r.id AND lp.status IN ('scheduled','live')
    )
  ORDER BY random()
  LIMIT 1;

  IF v_release_id IS NULL THEN
    RAISE EXCEPTION 'No eligible dummy release';
  END IF;

  SELECT id INTO v_room_id FROM rooms WHERE slug = 'global-master' LIMIT 1;

  v_scheduled := date_trunc('hour', now())
               + (floor(extract(minute FROM now()) / 15) + 2) * interval '15 minutes';

  WHILE EXISTS (
    SELECT 1 FROM listening_parties
    WHERE room_id = v_room_id AND scheduled_at = v_scheduled AND status IN ('scheduled','live')
  ) LOOP
    v_scheduled := v_scheduled + interval '15 minutes';
  END LOOP;

  INSERT INTO listening_parties (release_id, artist_id, room_id, scheduled_at, duration_seconds)
  VALUES (v_release_id, v_artist_id, v_room_id, v_scheduled, 900)
  RETURNING id INTO v_party_id;

  RAISE NOTICE 'Party % scheduled at % UTC', v_party_id, v_scheduled;
END $$;
