-- Remove stale current-study facts from semantic retrieval without deleting history.
-- We keep the records for audit/history, but null the embedding so vector RAG cannot rank them.

UPDATE public.vanguard_knowledge
SET
  is_verified = false,
  importance_score = LEAST(importance_score, 2),
  embedding = NULL,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'status', 'deprecated',
    'deprecated_reason', 'stale_current_education_conflict',
    'deprecated_by_migration', '20260514000003_deprecate_stale_education_knowledge'
  )
WHERE (
    lower(content) LIKE '%8 semestr%analiz%danych%'
    OR lower(content) LIKE '%student 8 semestru%analiz%danych%'
    OR lower(content) LIKE '%ostatni rok licencjatu%'
  )
  AND NOT (
    lower(content) LIKE '%ukończ%'
    OR lower(content) LIKE '%ukoncz%'
    OR lower(content) LIKE '%inżynier%'
    OR lower(content) LIKE '%inzynier%'
  );
