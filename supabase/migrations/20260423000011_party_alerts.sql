-- SynthCamp — users subscribe to be notified when a scheduled party goes live.
-- Phase 4 will fan out in-app notifications (and later email) when the party
-- transitions from 'scheduled' to 'live'. For now we just capture intent.

CREATE TABLE IF NOT EXISTS public.party_alerts (
  party_id uuid NOT NULL REFERENCES public.listening_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_party_alerts_party ON public.party_alerts(party_id);
CREATE INDEX IF NOT EXISTS idx_party_alerts_user ON public.party_alerts(user_id);

ALTER TABLE public.party_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS party_alerts_select_own ON public.party_alerts;
CREATE POLICY party_alerts_select_own ON public.party_alerts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS party_alerts_insert_own ON public.party_alerts;
CREATE POLICY party_alerts_insert_own ON public.party_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS party_alerts_delete_own ON public.party_alerts;
CREATE POLICY party_alerts_delete_own ON public.party_alerts FOR DELETE
  USING (auth.uid() = user_id);
