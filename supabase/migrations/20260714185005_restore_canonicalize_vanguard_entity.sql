-- The migration squash retained graph RPCs that depend on this helper, but
-- accidentally omitted the helper itself. Restore the original canonical
-- alias behavior so graph reads and writes compile and execute again.
CREATE OR REPLACE FUNCTION public.canonicalize_vanguard_entity(
  p_user_id uuid,
  p_name text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_lower text := lower(btrim(coalesce(p_name, '')));
  v_canonical text;
BEGIN
  IF v_name = '' THEN
    RETURN v_name;
  END IF;

  SELECT a.canonical
    INTO v_canonical
    FROM public.vanguard_entity_aliases AS a
   WHERE a.user_id = p_user_id
     AND lower(a.alias) = v_lower
   LIMIT 1;

  IF v_canonical IS NOT NULL THEN
    RETURN v_canonical;
  END IF;

  IF v_lower IN (
    'jakub', 'uzytkownik', 'użytkownik', 'uzytkownika', 'użytkownika',
    'osoba', 'person', 'student', 'user', 'ja', 'mnie', 'mi', 'mną', 'mna'
  ) THEN
    RETURN 'Jakub';
  END IF;

  RETURN v_name;
END;
$$;

REVOKE ALL ON FUNCTION public.canonicalize_vanguard_entity(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canonicalize_vanguard_entity(uuid, text)
  TO service_role;
