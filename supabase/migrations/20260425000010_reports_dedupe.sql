-- SynthCamp — partial unique index to dedupe open reports.
--
-- Without this, the same reporter can file the same report against the
-- same target every 20 minutes (the rate-limit window). Once a moderator
-- reviews/dismisses the report, the same reporter can file it again —
-- which is the intended workflow for "actually, this is still a problem".
--
-- The route catches error.code === '23505' and returns a friendly
-- "Report already submitted" message; the rest of the dedupe behaviour
-- lives in that handler.

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_open_dedupe
  ON public.reports (reporter_id, target_type, target_id)
  WHERE status = 'open';
