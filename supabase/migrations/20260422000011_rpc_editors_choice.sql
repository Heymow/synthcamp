-- SynthCamp Phase 2 Migration 11 — get_editors_choice RPC (top revenue 30d or Fresh fallback)

CREATE FUNCTION public.get_editors_choice()
RETURNS TABLE (
  release_id uuid,
  revenue_30d numeric,
  is_fallback boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  top_record record;
BEGIN
  SELECT r.id AS id, COALESCE(SUM(p.amount_paid), 0) AS rev, r.created_at AS created_at
  INTO top_record
  FROM public.releases r
  LEFT JOIN public.purchases p ON p.release_id = r.id
    AND p.purchased_at >= now() - interval '30 days'
  WHERE r.status = 'published' AND r.is_listed = true
  GROUP BY r.id, r.created_at
  HAVING COALESCE(SUM(p.amount_paid), 0) > 0
  ORDER BY rev DESC, r.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT top_record.id, top_record.rev, false;
  ELSE
    RETURN QUERY
    SELECT r.id, 0::numeric, true
    FROM public.releases r
    WHERE r.status = 'published' AND r.is_listed = true
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_editors_choice() TO anon, authenticated;
