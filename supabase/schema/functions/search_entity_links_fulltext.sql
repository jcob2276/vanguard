CREATE OR REPLACE FUNCTION public.search_entity_links_fulltext(
  query_text text,
  match_user_id uuid,
  match_count integer DEFAULT 15
) RETURNS TABLE(
  source_entity text,
  relation text,
  target_entity text,
  source_type text,
  target_type text,
  fact_text text,
  evidence_count integer,
  rank real
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    es.canonical_name AS source_entity,
    r.name AS relation,
    eo.canonical_name AS target_entity,
    es.kind AS source_type,
    eo.kind AS target_type,
    c.fact_text,
    c.evidence_count,
    ts_rank(to_tsvector('simple', COALESCE(c.fact_text, '')),
            plainto_tsquery('simple', query_text)) AS rank
  FROM public.claims c
  JOIN public.entities es ON c.subject_id = es.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities eo ON c.object_id = eo.id
  WHERE c.user_id = match_user_id
    AND c.status = 'active'
    AND c.epistemic_status IN ('fact', 'preference', 'prediction')
    AND c.valid_from <= now()
    AND (c.valid_to IS NULL OR c.valid_to > now())
    AND to_tsvector('simple', COALESCE(c.fact_text, '')) @@ plainto_tsquery('simple', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.search_entity_links_fulltext(text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_entity_links_fulltext(text, uuid, integer) TO authenticated, service_role;
