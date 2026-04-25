-- SynthCamp — allow artists to hard-delete their own draft releases.
--
-- The original migration (20260422000004_releases.sql) declared
-- `releases_no_delete FOR DELETE USING (false)`. Because RLS policies
-- are permissive by default, that single FALSE policy blocks every
-- DELETE — including the owner's attempt to throw away a draft from
-- the UI, which just silently affects 0 rows.
--
-- The API route (app/api/releases/[id]/route.ts DELETE handler) already
-- enforces "owner" and "status = 'draft'" before issuing the DELETE, but
-- defense-in-depth: RLS mirrors the check so we can't accidentally nuke a
-- published release even if the route check regressed.

CREATE POLICY releases_delete_own_draft ON public.releases
  FOR DELETE TO authenticated
  USING (artist_id = auth.uid() AND status = 'draft');
