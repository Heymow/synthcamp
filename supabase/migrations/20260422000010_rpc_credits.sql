-- SynthCamp Phase 2 Migration 10 — Creative Credits compute RPC + trigger wrapper

CREATE FUNCTION public.compute_release_credits_from_tracks(p_release_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  distinct_categories credit_category[];
  all_tags text[];
BEGIN
  SELECT array_agg(DISTINCT credit_category) FILTER (WHERE credit_category IS NOT NULL)
  INTO distinct_categories
  FROM public.tracks WHERE release_id = p_release_id;

  SELECT array_agg(DISTINCT tag)
  INTO all_tags
  FROM public.tracks t, LATERAL unnest(COALESCE(t.credit_tags, '{}'::text[])) AS tag
  WHERE t.release_id = p_release_id;

  UPDATE public.releases
  SET
    credit_category = CASE
      WHEN distinct_categories IS NULL OR array_length(distinct_categories, 1) = 0 THEN credit_category
      WHEN array_length(distinct_categories, 1) = 1 THEN distinct_categories[1]
      ELSE 'hybrid'::credit_category
    END,
    credit_tags = COALESCE(all_tags, '{}'),
    updated_at = now()
  WHERE id = p_release_id AND credits_per_track = true;
END;
$$;

CREATE FUNCTION public.trigger_recompute_release_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_release_id uuid;
BEGIN
  v_release_id := COALESCE(NEW.release_id, OLD.release_id);
  PERFORM public.compute_release_credits_from_tracks(v_release_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tracks_credits_update_trigger
AFTER INSERT OR UPDATE OF credit_category, credit_tags OR DELETE ON public.tracks
FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_release_credits();
