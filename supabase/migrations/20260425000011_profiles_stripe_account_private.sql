-- SynthCamp — move stripe_account_id + payout_enabled off public.profiles
-- and into a sibling table with per-owner RLS.
--
-- Background: public.profiles has a profiles_select_public USING (true)
-- policy so the whole web can read artist profiles. That policy leaked
-- stripe_account_id and payout_enabled to any anonymous caller.
-- Postgres lacks per-column RLS, so the cleanest fix is to relocate
-- the private fields into their own table with their own policies.
--
-- Migration steps:
--   1. Create public.profiles_stripe (1:1 with profiles).
--   2. Copy existing rows (if any) so no artist has to re-onboard.
--   3. Enable RLS, owner-only SELECT / UPDATE / INSERT, admin SELECT.
--   4. Drop the old columns from public.profiles.

CREATE TABLE IF NOT EXISTS public.profiles_stripe (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_account_id text UNIQUE,
  payout_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill from the old columns. Only rows that actually had a Stripe
-- account get copied; unused rows stay absent until the artist starts
-- onboarding (and the route inserts a fresh row).
INSERT INTO public.profiles_stripe (profile_id, stripe_account_id, payout_enabled)
SELECT id, stripe_account_id, payout_enabled
FROM public.profiles
WHERE stripe_account_id IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

ALTER TABLE public.profiles_stripe ENABLE ROW LEVEL SECURITY;

-- Owner can read, update, insert their own row. No public SELECT.
DROP POLICY IF EXISTS profiles_stripe_select_own ON public.profiles_stripe;
CREATE POLICY profiles_stripe_select_own ON public.profiles_stripe
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS profiles_stripe_insert_own ON public.profiles_stripe;
CREATE POLICY profiles_stripe_insert_own ON public.profiles_stripe
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS profiles_stripe_update_own ON public.profiles_stripe;
CREATE POLICY profiles_stripe_update_own ON public.profiles_stripe
  FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Admin SELECT so the moderation UI can see Connect status if needed.
DROP POLICY IF EXISTS profiles_stripe_select_admin ON public.profiles_stripe;
CREATE POLICY profiles_stripe_select_admin ON public.profiles_stripe
  FOR SELECT USING (public.is_current_user_admin());

-- Webhook lookups query by stripe_account_id; keep a supporting index.
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id
  ON public.profiles_stripe(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- Reuse the shared set_updated_at() trigger.
DROP TRIGGER IF EXISTS profiles_stripe_set_updated_at ON public.profiles_stripe;
CREATE TRIGGER profiles_stripe_set_updated_at
  BEFORE UPDATE ON public.profiles_stripe
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Finally, drop the now-redundant columns from public.profiles. The old
-- idx_profiles_stripe_account_id index on public.profiles is dropped
-- automatically when the column goes.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_account_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS payout_enabled;
