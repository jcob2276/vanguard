-- Keep fuzzy resolution permissive across kinds, but rank same-kind matches
-- first. Previously p_kind was ignored entirely.
CREATE OR REPLACE FUNCTION public.resolve_entity_fuzzy_candidates(
  p_user_id uuid,
  p_name text,
  p_kind text
)
RETURNS TABLE(
  entity_id uuid,
  canonical_name text,
  alias text,
  sim double precision,
  kind text
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ea.entity_id,
    e.canonical_name,
    ea.alias,
    similarity(ea.alias, trim(p_name))::double precision AS sim,
    e.kind
  FROM public.entity_aliases AS ea
  JOIN public.entities AS e ON e.id = ea.entity_id
  WHERE e.user_id = p_user_id
    AND similarity(ea.alias, trim(p_name)) > 0.3
  ORDER BY (e.kind = p_kind) DESC, sim DESC
  LIMIT 10;
END;
$$;
