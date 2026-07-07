CREATE OR REPLACE FUNCTION public.search_entity_links(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int DEFAULT 20
) RETURNS TABLE (
  source_entity  text,
  relation       text,
  target_entity  text,
  source_type    text,
  target_type    text,
  evidence_count int,
  similarity     float
) LANGUAGE sql STABLE AS $$
  SELECT
    s.canonical_name AS source_entity,
    r.name AS relation,
    o.canonical_name AS target_entity,
    s.kind AS source_type,
    o.kind AS target_type,
    c.evidence_count,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.claims c
  JOIN public.entities s ON c.subject_id = s.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities o ON c.object_id = o.id
  WHERE c.user_id = match_user_id
    AND c.embedding IS NOT NULL
    AND c.status = 'active'
    AND (c.valid_to IS NULL OR c.valid_to > now())
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER FUNCTION public.search_entity_links(vector, uuid, integer) SET search_path = public, pg_temp;
