-- ============================================================
-- VANGUARD OS — ADD GOAL PAGE TYPE TO WIKI PAGES
-- ============================================================

-- Drop the old check constraint
ALTER TABLE public.vanguard_wiki_pages 
  DROP CONSTRAINT IF EXISTS vanguard_wiki_pages_page_type_check;

-- Add the new check constraint containing 'goal'
ALTER TABLE public.vanguard_wiki_pages 
  ADD CONSTRAINT vanguard_wiki_pages_page_type_check 
  CHECK (page_type = ANY (ARRAY[
    'identity'::text, 
    'behavior_pattern'::text, 
    'person'::text, 
    'project'::text, 
    'training'::text, 
    'health'::text, 
    'decision'::text, 
    'friction_loop'::text, 
    'concept'::text, 
    'source_summary'::text, 
    'operating_model'::text,
    'goal'::text
  ]));
