-- SynthCamp Phase 2 Migration 15 — pg_cron job to auto-publish party-less scheduled releases

CREATE FUNCTION public.cron_publish_future_releases()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.releases r
  SET status = 'published', updated_at = now()
  WHERE r.status = 'scheduled'
    AND r.release_date IS NOT NULL
    AND r.release_date <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.listening_parties p
      WHERE p.release_id = r.id
        AND p.status NOT IN ('cancelled', 'ended')
    );
$$;

SELECT cron.schedule(
  'publish-future-releases',
  '* * * * *',
  $$SELECT public.cron_publish_future_releases();$$
);
