-- Quarantine legacy graph edges that do not conform to the relation ontology.
-- This removes them from Oracle graph retrieval without deleting historical data.

UPDATE public.vanguard_entity_links el
SET
  status = 'deprecated',
  valid_until = coalesce(el.valid_until, now()),
  metadata = coalesce(el.metadata, '{}'::jsonb) || jsonb_build_object(
    'quarantine_reason', 'relation outside vanguard_relation_ontology',
    'quarantined_at', now(),
    'previous_status', el.status
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vanguard_relation_ontology ro
  WHERE ro.relation = el.relation
)
AND el.status = 'active';
