-- SynthCamp Phase 3 Lot 3 — purchase RPCs.
--
-- Three SECURITY DEFINER helpers used by the Checkout endpoint and the
-- webhook handler:
--   1. effective_min_price(release_id)        → cents (integer)
--   2. is_release_purchasable(release_id)     → boolean
--   3. record_purchase(...)                   → uuid (purchase id)
--
-- All assume the caller authentication has already happened in the route
-- handler. The RPCs are SECURITY DEFINER so they bypass RLS for the
-- write that creates a pending purchase row (the user can't INSERT
-- purchases directly per Lot 1's RLS).

-- 1. Effective minimum price in cents, applying the party-live discount
-- iff a party is currently live for the release.
-- VOLATILE because we read now() via the live-party EXISTS — STABLE could
-- let PG cache a plan-time result.
CREATE OR REPLACE FUNCTION public.effective_min_price_cents(p_release_id uuid)
RETURNS int
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track_count int;
  v_discount_pct int;
  v_party_live boolean;
  v_base_cents int;
BEGIN
  SELECT count(*) INTO v_track_count
    FROM public.tracks WHERE release_id = p_release_id;

  IF v_track_count IS NULL OR v_track_count = 0 THEN
    RAISE EXCEPTION 'Release % has no tracks', p_release_id USING ERRCODE = '22023';
  END IF;

  SELECT party_live_discount_pct INTO v_discount_pct
    FROM public.releases WHERE id = p_release_id;

  -- Mirror lib/pricing.ts:getPrice exactly: ceil(n * 0.6) - 0.01 dollars.
  -- For n=3: ceil(1.8) = 2 → $2 - $0.01 = $1.99 = 199 cents.
  -- IMPORTANT: ceil(n * 60) ≠ ceil(n * 0.6) * 100 in general.
  -- We need ceil first on dollars, then convert: (ceil(n * 0.6) * 100) - 1.
  v_base_cents := (ceil(v_track_count * 0.6)::int * 100) - 1;

  v_party_live := EXISTS (
    SELECT 1 FROM public.listening_parties
    WHERE release_id = p_release_id
      AND status = 'live'
      AND ends_at > now()
  );

  IF v_party_live AND v_discount_pct > 0 THEN
    RETURN floor(v_base_cents * (100 - v_discount_pct) / 100.0)::int;
  END IF;
  RETURN v_base_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.effective_min_price_cents(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.effective_min_price_cents(uuid) TO authenticated, service_role;

-- 2. Is the release purchasable RIGHT NOW?
-- Rules per spec §9:
--   - Release must be 'published' (post-party live → ended → published flow)
--     OR be 'scheduled' AND have a party currently live.
--   - Artist must have payout_enabled=true.
--   - Buyer cannot have an active (non-refunded) purchase already.
CREATE OR REPLACE FUNCTION public.is_release_purchasable(
  p_release_id uuid,
  p_buyer_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_release record;
  v_payout_ok boolean;
  v_party_live boolean;
  v_already_owns boolean;
BEGIN
  SELECT id, artist_id, status INTO v_release
    FROM public.releases WHERE id = p_release_id;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT COALESCE(payout_enabled, false) INTO v_payout_ok
    FROM public.profiles_stripe WHERE profile_id = v_release.artist_id;
  IF NOT COALESCE(v_payout_ok, false) THEN RETURN false; END IF;

  v_party_live := EXISTS (
    SELECT 1 FROM public.listening_parties
    WHERE release_id = p_release_id
      AND status = 'live'
      AND ends_at > now()
  );

  -- Status gate: published (post-party-end) OR scheduled-and-party-live.
  IF v_release.status = 'published' THEN
    NULL; -- ok
  ELSIF v_release.status = 'scheduled' AND v_party_live THEN
    NULL; -- ok per spec: pre-orders disabled but mid-party purchases allowed
  ELSE
    RETURN false;
  END IF;

  v_already_owns := EXISTS (
    SELECT 1 FROM public.purchases
    WHERE release_id = p_release_id
      AND buyer_id = p_buyer_id
      AND status != 'refunded'
  );
  IF v_already_owns THEN RETURN false; END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.is_release_purchasable(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_release_purchasable(uuid, uuid) TO authenticated, service_role;

-- 3. Record the purchase row at Checkout creation time. Status is 'pending'
-- until the webhook fires checkout.session.completed.
CREATE OR REPLACE FUNCTION public.record_purchase(
  p_buyer_id uuid,
  p_release_id uuid,
  p_amount_paid_cents int,
  p_amount_min_cents int,
  p_platform_fee_cents int,
  p_artist_payout_cents int,
  p_currency text,
  p_stripe_session_id text,
  p_party_discount_applied boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artist_id uuid;
  v_purchase_id uuid;
BEGIN
  SELECT artist_id INTO v_artist_id FROM public.releases WHERE id = p_release_id;
  IF v_artist_id IS NULL THEN
    RAISE EXCEPTION 'Release % not found', p_release_id USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.purchases (
    buyer_id, release_id, artist_id,
    amount_paid_cents, amount_min_cents,
    platform_fee_cents, artist_payout_cents,
    currency,
    stripe_session_id,
    status,
    party_discount_applied
  ) VALUES (
    p_buyer_id, p_release_id, v_artist_id,
    p_amount_paid_cents, p_amount_min_cents,
    p_platform_fee_cents, p_artist_payout_cents,
    COALESCE(p_currency, 'usd'),
    p_stripe_session_id,
    'pending',
    p_party_discount_applied
  )
  RETURNING id INTO v_purchase_id;

  RETURN v_purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_purchase FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, uuid, int, int, int, int, text, text, boolean) TO service_role;

-- Note: record_purchase is service_role-only by design. The Checkout route
-- (which has already authenticated the buyer and validated the amount)
-- calls it via getSupabaseServiceRoleClient() so the row insert bypasses
-- the purchases-RLS no-INSERT policy. Calling it from the user-cookied
-- client would fail with "permission denied for function".
