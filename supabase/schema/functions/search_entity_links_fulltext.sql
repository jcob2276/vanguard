CREATE OR REPLACE FUNCTION public.search_entity_links_fulltext(
  query_text     text,
  match_user_id  uuid,
  match_count    int DEFAULT 20
) RETURNS TABLE (
  evidence_count int,
  fact_text      text,
  rank           float,
  relation       text,
  source_entity  text,
  source_type    text,
  target_entity  text,
  target_type    text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.evidence_count,
    c.fact_text,
    ts_rank_cd(to_tsvector('polish', c.fact_text), plainto_tsquery('polish', query_text))::float AS rank,
    r.name AS relation,
    s.canonical_name AS source_entity,
    s.kind AS source_type,
    o.canonical_name AS target_entity,
    o.kind AS target_type
  FROM public.claims c
  JOIN public.entities s ON c.subject_id = s.id
  JOIN public.relations r ON c.relation_id = r.id
  JOIN public.entities o ON c.object_id = o.id
  WHERE c.user_id = match_user_id
    AND c.fact_text IS NOT NULL
    AND c.status = 'active'
    AND (c.valid_to IS NULL OR c.valid_to > now())
    AND to_tsvector('polish', c.fact_text) @@ plainto_tsquery('polish', query_text)
  ORDER BY rank DESC
  LIMIT match_count;
$$;

ALTER FUNCTION public.search_entity_links_fulltext(text, uuid, integer) SET search_path = public, pg_temp;
