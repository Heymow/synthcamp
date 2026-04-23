-- SynthCamp — returns the most-used genres across published releases,
-- ranked by count. Used by /explore/search to render the genre chips.

CREATE OR REPLACE FUNCTION public.popular_genres(p_limit integer DEFAULT 15)
RETURNS TABLE(genre text, c bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g AS genre, count(*)::bigint AS c
  FROM public.releases r, unnest(r.genres) AS g
  WHERE r.status = 'published' AND r.is_listed = true
  GROUP BY g
  ORDER BY c DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.popular_genres(integer) TO anon, authenticated;
