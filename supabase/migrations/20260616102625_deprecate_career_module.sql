-- Mark the removed Kariera module as deprecated without deleting data.
-- Active product surfaces use public.projects and public.todo_* instead.
COMMENT ON TABLE public.career_projects IS
  'DEPRECATED: legacy data model for the removed Kariera module. Use public.projects for the Projekty section.';
COMMENT ON TABLE public.career_moves IS
  'DEPRECATED: legacy moves for the removed Kariera module. Use public.todo_items optionally bridged through todo_sections.project_id.';
COMMENT ON TABLE public.career_evidence IS
  'DEPRECATED: legacy evidence for the removed Kariera module. Do not add new product writes.';
COMMENT ON TABLE public.career_decisions IS
  'DEPRECATED: legacy decisions for the removed Kariera module. Do not add new product writes.';
