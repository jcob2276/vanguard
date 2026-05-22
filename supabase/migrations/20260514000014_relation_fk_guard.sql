-- Hard database guard for graph relation ontology.
-- NOT VALID keeps legacy out-of-ontology edges readable, but enforces the FK
-- for all new inserts and relation updates.

CREATE OR REPLACE FUNCTION public.check_vanguard_relation_ontology()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  NEW.relation := btrim(NEW.relation);

  IF NEW.relation IS NULL OR NEW.relation = '' THEN
    RAISE EXCEPTION 'Graph relation cannot be empty';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vanguard_relation_ontology
    WHERE relation = NEW.relation
  ) THEN
    SELECT count(*) INTO v_count FROM public.vanguard_relation_ontology;
    RAISE EXCEPTION 'Graph relation "%" is outside vanguard_relation_ontology (% allowed relations)', NEW.relation, v_count;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_vanguard_relation ON public.vanguard_entity_links;
CREATE TRIGGER trigger_check_vanguard_relation
BEFORE INSERT OR UPDATE OF relation ON public.vanguard_entity_links
FOR EACH ROW
EXECUTE FUNCTION public.check_vanguard_relation_ontology();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vanguard_entity_links_relation_fkey'
      AND conrelid = 'public.vanguard_entity_links'::regclass
  ) THEN
    ALTER TABLE public.vanguard_entity_links
    ADD CONSTRAINT vanguard_entity_links_relation_fkey
    FOREIGN KEY (relation)
    REFERENCES public.vanguard_relation_ontology(relation)
    NOT VALID;
  END IF;
END;
$$;
