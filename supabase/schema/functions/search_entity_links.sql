CREATE OR REPLACE FUNCTION public.search_entity_links(
  query_embedding public.vector,
  match_user_id uuid,
  match_count integer DEFAULT 15
) RETURNS TABLE(
  source_entity text,
  relation text,
  target_entity text,
  source_type text,
  target_type text,
  evidence_count integer,
  similarity double precision,
  confidence_score double precision,
  fact_text text,
  memory_type text
)
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT
    es.canonical_name AS source_entity,
    r.name AS relation,
    eo.canonical_name AS target_entity,
    es.kind AS source_type,
    eo.kind AS target_type,
    c.evidence_count,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.weight AS confidence_score,
    c.fact_text,
    CASE WHEN c.epistemic_status = 'fact' THEN 'declared' ELSE c.epistemic_status END AS memory_type
  FROM public.claims c
  JOIN public.entities es ON c.subject_id = es.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities eo ON c.object_id = eo.id
  WHERE c.user_id = match_user_id
    AND c.embedding IS NOT NULL
    AND c.status = 'active'
    AND c.epistemic_status IN ('fact', 'preference', 'prediction')
    AND c.valid_from <= now()
    AND (c.valid_to IS NULL OR c.valid_to > now())
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.search_entity_links(public.vector, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_entity_links(public.vector, uuid, integer) TO authenticated, service_role;
