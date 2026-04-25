-- SynthCamp Phase 3 — RLS for purchases table + extend tracks RLS for buyers.
--
-- Buyer can read their own purchase row (for /explore/library + receipt).
-- Artist can read purchases of their own releases (for sales reporting).
-- Admin can read everything (for support / audit).
-- INSERT/UPDATE/DELETE are service-role only — Stripe webhook owns writes,
-- never the client.

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY has no IF NOT EXISTS, so drop-then-create for idempotency.
DROP POLICY IF EXISTS purchases_select_buyer ON public.purchases;
CREATE POLICY purchases_select_buyer ON public.purchases FOR SELECT
  USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS purchases_select_artist ON public.purchases;
CREATE POLICY purchases_select_artist ON public.purchases FOR SELECT
  USING (auth.uid() = artist_id);

DROP POLICY IF EXISTS purchases_select_admin ON public.purchases;
CREATE POLICY purchases_select_admin ON public.purchases FOR SELECT
  USING (public.is_current_user_admin());

-- No INSERT/UPDATE/DELETE policies → all client mutations denied. Service
-- role bypasses RLS, used by the webhook handler.

-- Extend tracks_select_via_release so a buyer of an archived release still
-- streams. Phase 2 policy hid the track once the release was archived; that
-- breaks the lifetime-access guarantee for purchasers. Drop and recreate.
DROP POLICY IF EXISTS tracks_select_via_release ON public.tracks;

CREATE POLICY tracks_select_via_release ON public.tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = tracks.release_id
        AND (
          -- Public catalog visibility (unchanged from phase 2)
          r.status IN ('published', 'unlisted', 'scheduled')
          -- Owner sees their own (unchanged)
          OR r.artist_id = auth.uid()
          -- Admin sees everything
          OR public.is_current_user_admin()
          -- Phase 3 addition: buyers retain access even after archive
          OR EXISTS (
            SELECT 1 FROM public.purchases p
            WHERE p.release_id = r.id
              AND p.buyer_id = auth.uid()
              AND p.status = 'succeeded'
          )
        )
    )
  );
