-- Keep old 10-argument RPC callers compatible with the 12-argument Graphiti upsert.
-- Also add ASCII relation names used by extraction prompts so the ontology trigger
-- does not block new graph growth.

INSERT INTO public.vanguard_relation_ontology (relation, description) VALUES
  ('ma_relacje_z', 'Relacja interpersonalna, ASCII canonical'),
  ('zna_osobe', 'Znajomosc lub relacja kolezenska, ASCII canonical'),
  ('boi_sie', 'Strach, lek lub obawa, ASCII canonical'),
  ('czuje', 'Stan emocjonalny lub fizyczny'),
  ('odczuwa', 'Stan emocjonalny lub fizyczny, alias'),
  ('wywoluje', 'Zwiazek przyczynowy lub emocjonalny'),
  ('wzmacnia', 'Pozytywny wplyw lub wzmacnianie wzorca'),
  ('oslabia', 'Negatywny wplyw lub oslabianie wzorca'),
  ('pochodzi_z', 'Pochodzenie osoby lub zrodlo zjawiska'),
  ('ma_wspomnienie_z', 'Wspomnienie powiazane z okresem, miejscem lub osoba'),
  ('pracuje_nad', 'Aktywna praca nad projektem, celem lub problemem'),
  ('uczy_sie', 'Nabywanie nowej wiedzy lub umiejetnosci, ASCII canonical'),
  ('cwiczy', 'Aktywnosc fizyczna lub trening, ASCII canonical'),
  ('deklaruje', 'Stwierdzenie lub wyznanie'),
  ('dotyczy', 'Relacja tematyczna lub odniesienie'),
  ('reaguje_na', 'Reakcja behawioralna lub biologiczna')
ON CONFLICT (relation) DO NOTHING;

UPDATE public.vanguard_entity_links
SET relation = CASE
  WHEN relation IN ('ma_relacjÄ™_z', 'ma_relację_z') THEN 'ma_relacje_z'
  WHEN relation IN ('zna_osobÄ™', 'zna_osobę') THEN 'zna_osobe'
  WHEN relation IN ('lÄ™ka_siÄ™', 'lęka_się') THEN 'boi_sie'
  WHEN relation IN ('uczy_siÄ™', 'uczy_się') THEN 'uczy_sie'
  WHEN relation IN ('Ä‡wiczy', 'ćwiczy') THEN 'cwiczy'
  ELSE relation
END
WHERE relation IN (
  'ma_relacjÄ™_z', 'ma_relację_z',
  'zna_osobÄ™', 'zna_osobę',
  'lÄ™ka_siÄ™', 'lęka_się',
  'uczy_siÄ™', 'uczy_się',
  'Ä‡wiczy', 'ćwiczy'
);

CREATE OR REPLACE FUNCTION public.upsert_vanguard_entity_link(
  p_user_id uuid,
  p_source text,
  p_source_type text,
  p_relation text,
  p_target text,
  p_target_type text,
  p_confidence_score double precision DEFAULT 0.6,
  p_memory_type text DEFAULT 'fact'::text,
  p_layer text DEFAULT 'intelligence'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.upsert_vanguard_entity_link(
    p_user_id           => p_user_id,
    p_source            => p_source,
    p_source_type       => p_source_type,
    p_relation          => p_relation,
    p_target            => p_target,
    p_target_type       => p_target_type,
    p_confidence_score  => p_confidence_score,
    p_memory_type       => p_memory_type,
    p_layer             => p_layer,
    p_metadata          => p_metadata,
    p_source_episode_id => NULL,
    p_observed_at       => NULL
  );
END;
$$;
