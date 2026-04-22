-- SynthCamp Phase 2 Migration 7 — party_moderators table

CREATE TABLE public.party_moderators (
  party_id uuid NOT NULL REFERENCES public.listening_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_during_party boolean NOT NULL DEFAULT false,
  PRIMARY KEY (party_id, user_id)
);

ALTER TABLE public.party_moderators ENABLE ROW LEVEL SECURITY;

CREATE POLICY party_moderators_select_public ON public.party_moderators FOR SELECT USING (true);

CREATE POLICY party_moderators_write ON public.party_moderators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.listening_parties p
      WHERE p.id = party_id
        AND (
          p.artist_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.party_moderators pm WHERE pm.party_id = p.id AND pm.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.listening_parties p
      WHERE p.id = party_id
        AND (
          p.artist_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.party_moderators pm WHERE pm.party_id = p.id AND pm.user_id = auth.uid())
        )
    )
  );
