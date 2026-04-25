-- SynthCamp Phase 3 — Stripe webhook event ledger for idempotency.
--
-- Every webhook hit inserts the evt_id first; if it's a duplicate (Stripe
-- retries), the unique-violation tells the handler to no-op. Stored payload
-- aids debugging. Service-role only — clients never see this table.

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,  -- evt_xxx from Stripe
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_unprocessed
  ON public.stripe_events (received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies. Service-role only.
