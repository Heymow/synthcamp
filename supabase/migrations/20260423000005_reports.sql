-- SynthCamp — user-submitted reports. Phase 2 collects; phase 5 will build
-- an admin review UI that queries with service role. For now, users see
-- only their own reports (support flow), nobody can UPDATE or DELETE.

CREATE TYPE report_target_type AS ENUM ('release', 'profile', 'party', 'track');
CREATE TYPE report_status AS ENUM ('open', 'reviewed', 'dismissed');

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  status report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX idx_reports_status_created ON public.reports(status, created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_select_own ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY reports_insert_own ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);
