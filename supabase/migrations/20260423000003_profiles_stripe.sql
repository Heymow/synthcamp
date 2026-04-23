-- SynthCamp — store Stripe Connect Express account id on artist profiles.
-- Phase 3 will flip payout_enabled to true via webhook when account.updated
-- shows details_submitted + charges_enabled + payouts_enabled.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT false;

-- Allow the owner to read their own stripe_account_id; public SELECT
-- policy already covers it but we add an index since webhook lookups
-- query by this column.
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id
  ON public.profiles(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;
