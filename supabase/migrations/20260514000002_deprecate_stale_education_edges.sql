-- Keep historical education facts, but stop treating stale current-study edges as active.
-- Current active study is Cyberbezpieczenstwo; Analiza Danych is historical/completed.

WITH current_cyber AS (
  SELECT id
  FROM public.vanguard_entity_links
  WHERE source_entity = 'Jakub'
    AND relation = 'studiuje'
    AND target_entity ILIKE '%Cyberbezpiecze%'
  ORDER BY evidence_count DESC, created_at DESC
  LIMIT 1
)
UPDATE public.vanguard_entity_links l
SET
  status = 'deprecated',
  valid_until = coalesce(valid_until, now()),
  superseded_by = (SELECT id FROM current_cyber),
  metadata = coalesce(l.metadata, '{}'::jsonb) || jsonb_build_object(
    'deprecated_reason', 'stale_current_education_conflict',
    'deprecated_by_migration', '20260514000002_deprecate_stale_education_edges'
  )
WHERE l.source_entity = 'Jakub'
  AND lower(l.target_entity) LIKE '%analiz%danych%'
  AND lower(l.relation) IN ('jest na', 'studies', 'studiuje', 'jest na studiach');
