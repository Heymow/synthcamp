-- SynthCamp — follow graph (phase 5 groundwork, used in phase 2 for the
-- Follow button + follower counts on artist profiles).

CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE INDEX idx_follows_followed ON public.follows(followed_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY follows_select_public ON public.follows FOR SELECT USING (true);

CREATE POLICY follows_insert_own ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY follows_delete_own ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);
