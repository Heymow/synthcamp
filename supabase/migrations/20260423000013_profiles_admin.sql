-- SynthCamp — admin flag on profiles + expand reports RLS so admins can
-- read/moderate every submission.
--
-- A user is granted admin by a service-role UPDATE (no public "become-admin"
-- API). Phase 5 might add an admin invite flow; phase 2 just needs one of
-- us flipping the flag for the founding team.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Admins can SELECT any report. Keep the select-own policy so reporters
-- still see their own threads in case an admin UI isn't around.
DROP POLICY IF EXISTS reports_select_admin ON public.reports;
CREATE POLICY reports_select_admin ON public.reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Admins can UPDATE a report's status (reviewed / dismissed).
DROP POLICY IF EXISTS reports_update_admin ON public.reports;
CREATE POLICY reports_update_admin ON public.reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
