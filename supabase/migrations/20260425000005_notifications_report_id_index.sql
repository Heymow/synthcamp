-- SynthCamp — partial expression index on notifications for the dedupe
-- lookup inside notify_admins_of_report.
--
-- The RPC checks EXISTS (SELECT 1 FROM notifications
--   WHERE payload->>'report_id' = X AND kind = 'report_created').
-- Without an index that probe scans the full notifications table on every
-- report submission, which grows O(n) as we accumulate notification rows.
-- The partial expression index keeps it O(log n) and stays small because it
-- only covers the report_created subset.

CREATE INDEX IF NOT EXISTS idx_notifications_report_id_lookup
  ON public.notifications ((payload->>'report_id'))
  WHERE kind = 'report_created';
