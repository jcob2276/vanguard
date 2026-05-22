-- Remove legacy graph function overloads and duplicate stream classification trigger.
-- Keeping them around makes older callers bypass canonicalization/confidence/layer metadata.

DROP TRIGGER IF EXISTS trigger_vanguard_classify ON public.vanguard_stream;
DROP FUNCTION IF EXISTS public.vanguard_classify_on_insert();

DROP FUNCTION IF EXISTS public.get_vanguard_graph_context(text[], integer, uuid);
DROP FUNCTION IF EXISTS public.get_vanguard_graph_context(text[], integer, uuid, text);

DROP FUNCTION IF EXISTS public.upsert_vanguard_entity_link(uuid, text, text, text, text, text);
