-- SynthCamp Phase 2 Migration 8 — purchases table (Phase 2 schema, populated Phase 3)

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE RESTRICT,
  amount_paid numeric(10,2) NOT NULL CHECK (amount_paid >= 0),
  stripe_payment_intent text UNIQUE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, release_id)
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_select_self_or_artist ON public.purchases FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.releases r WHERE r.id = release_id AND r.artist_id = auth.uid())
  );

CREATE INDEX idx_purchases_release_date ON public.purchases(release_id, purchased_at DESC);
