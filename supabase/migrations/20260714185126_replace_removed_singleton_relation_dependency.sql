-- The old singleton lookup table was intentionally removed after `relations`
-- became the canonical ontology, but this graph write RPC still referenced it.
-- Patch the retained function definition in place to preserve its full behavior
-- while switching the lookup to the current SSOT.
DO $migration$
DECLARE
  v_definition text;
  v_old_fragment constant text := $old$
  SELECT EXISTS(
    SELECT 1 FROM public.vanguard_singleton_relations WHERE relation = v_relation
  ) INTO v_is_singleton;
$old$;
  v_new_fragment constant text := $new$
  SELECT coalesce((
    SELECT r.is_singleton
    FROM public.relations AS r
    WHERE r.name = v_relation
  ), false) INTO v_is_singleton;
$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO v_definition
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'upsert_vanguard_entity_link';

  IF v_definition IS NULL OR position(v_old_fragment IN v_definition) = 0 THEN
    RAISE EXCEPTION 'expected singleton lookup was not found in upsert_vanguard_entity_link';
  END IF;

  EXECUTE replace(v_definition, v_old_fragment, v_new_fragment);
END;
$migration$;

ALTER FUNCTION public.upsert_vanguard_entity_link(
  uuid, text, text, text, text, text, double precision, text, text, jsonb,
  uuid, timestamp with time zone
) SET search_path = '';
