-- SynthCamp — in-app notifications. Email delivery lands in phase 3 along
-- with user-level notification preferences.

CREATE TYPE notification_kind AS ENUM ('release_published', 'party_scheduled', 'follow');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind notification_kind NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fan out a notification to every follower of the release's artist.
-- SECURITY DEFINER so the publishing artist can insert rows owned by
-- other users (each follower) without needing direct INSERT privilege.
CREATE OR REPLACE FUNCTION public.fanout_release_notification(p_release_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, payload)
  SELECT
    f.follower_id,
    'release_published'::notification_kind,
    jsonb_build_object(
      'release_id', r.id,
      'release_title', r.title,
      'release_slug', r.slug,
      'artist_id', r.artist_id,
      'artist_name', p.display_name,
      'artist_slug', p.slug
    )
  FROM public.releases r
  JOIN public.profiles p ON p.id = r.artist_id
  JOIN public.follows f ON f.followed_id = r.artist_id
  WHERE r.id = p_release_id
    AND r.status = 'published';
END;
$$;

GRANT EXECUTE ON FUNCTION public.fanout_release_notification(uuid) TO authenticated;
