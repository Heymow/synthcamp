-- SynthCamp Phase 3 — production purchases table.
--
-- Replaces the phase 2 stub `purchases` table (which had `amount_paid numeric`,
-- `purchased_at`, no status, no platform_fee/artist_payout split). Phase 2 left
-- it empty; this migration drops it and creates the production shape with cents
-- columns, status state machine, tip computation, and Stripe ID columns.
--
-- The existing get_editors_choice() RPC referenced the dropped columns; we
-- rewrite it against the new schema in the same migration so the homepage
-- stops 500ing at deploy time.

DROP TABLE IF EXISTS public.purchases CASCADE;

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE RESTRICT,
  artist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_paid_cents int NOT NULL,
  amount_min_cents int NOT NULL,
  tip_cents int GENERATED ALWAYS AS (amount_paid_cents - amount_min_cents) STORED,
  platform_fee_cents int NOT NULL,
  artist_payout_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_session_id text UNIQUE NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'refunded')),
  party_discount_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz
);

-- One non-refunded purchase per release per buyer. Refunded buyers can repurchase.
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_one_per_buyer_release
  ON public.purchases (buyer_id, release_id)
  WHERE status != 'refunded';

CREATE INDEX IF NOT EXISTS idx_purchases_artist
  ON public.purchases (artist_id, succeeded_at DESC)
  WHERE status = 'succeeded';

CREATE INDEX IF NOT EXISTS idx_purchases_release
  ON public.purchases (release_id, succeeded_at DESC)
  WHERE status = 'succeeded';

-- Rewrite get_editors_choice against the new column names. PL/pgSQL bodies
-- aren't validated at CREATE time, so the original would persist with stale
-- references; replace it explicitly here.
CREATE OR REPLACE FUNCTION public.get_editors_choice()
RETURNS TABLE (
  release_id uuid,
  revenue_30d numeric,
  is_fallback boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  top_record record;
BEGIN
  SELECT r.id AS id,
         COALESCE(SUM(p.amount_paid_cents), 0)::numeric / 100 AS rev,
         r.created_at AS created_at
  INTO top_record
  FROM public.releases r
  LEFT JOIN public.purchases p ON p.release_id = r.id
    AND p.status = 'succeeded'
    AND p.succeeded_at >= now() - interval '30 days'
  WHERE r.status = 'published' AND r.is_listed = true
  GROUP BY r.id, r.created_at
  HAVING COALESCE(SUM(p.amount_paid_cents), 0) > 0
  ORDER BY rev DESC, r.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT top_record.id, top_record.rev, false;
  ELSE
    RETURN QUERY
    SELECT r.id, 0::numeric, true
    FROM public.releases r
    WHERE r.status = 'published' AND r.is_listed = true
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_editors_choice() TO anon, authenticated;
