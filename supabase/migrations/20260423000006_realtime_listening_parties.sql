-- SynthCamp — enable Realtime on listening_parties so clients can subscribe
-- to status changes (scheduled → live → ended) without polling.
--
-- NOTE: this migration is a no-op if the Realtime container / the
-- supabase_realtime publication isn't deployed yet. Skip if Realtime
-- isn't installed on the VPS; the hook falls back to the server-
-- rendered initial status in that case.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- idempotent: IF NOT IN ... check via pg_publication_tables
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'listening_parties'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.listening_parties;
    END IF;
  END IF;
END
$$;
