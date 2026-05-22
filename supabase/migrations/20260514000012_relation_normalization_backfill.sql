-- Conservative cleanup of legacy graph relation names.
-- Handles duplicate unique keys by merging evidence into one survivor first.

INSERT INTO public.vanguard_relation_ontology (relation, description) VALUES
  ('wykonuje', 'Wykonywanie czynnosci lub zadania'),
  ('spozywa', 'Spozywanie jedzenia, napoju lub substancji'),
  ('uczestniczy_w', 'Udzial w wydarzeniu, aktywnosci lub procesie'),
  ('analizuje', 'Analiza, obserwacja lub badanie zjawiska'),
  ('wskazuje_na', 'Wskazanie na stan, problem lub wniosek'),
  ('brakuje', 'Brak zasobu, cechy lub danych'),
  ('jest_alternatywa_dla', 'Relacja alternatywy lub zamiennika'),
  ('ma_egzamin', 'Powiazanie osoby z egzaminem'),
  ('ma_wskaznik', 'Powiazanie encji ze wskaznikiem lub metryka'),
  ('preferuje', 'Preferencja, wartosc lub upodobanie'),
  ('udziela_rady', 'Relacja doradcza lub rekomendacja'),
  ('monitoruje', 'Monitorowanie przez system, osobe lub narzedzie'),
  ('nawiazuje_kontakt_z', 'Inicjowanie kontaktu z osoba'),
  ('ma_nawyk', 'Powiazanie osoby z nawykiem'),
  ('ma_tendencje_do', 'Powtarzalna tendencja lub sklonnosc'),
  ('zmienia', 'Zmiana stanu, zachowania lub faktu'),
  ('chroni', 'Ochrona przed ryzykiem lub stanem'),
  ('jest_narzedziem_do', 'Narzedzie sluzace do celu'),
  ('pamieta', 'Pamiec lub zapis informacji')
ON CONFLICT (relation) DO NOTHING;

CREATE TEMP TABLE tmp_relation_map (
  old_relation text PRIMARY KEY,
  new_relation text NOT NULL
) ON COMMIT DROP;

INSERT INTO tmp_relation_map (old_relation, new_relation) VALUES
  ('wpływa na', 'prowadzi_do'),
  ('wpływa_na', 'prowadzi_do'),
  ('powoduje', 'prowadzi_do'),
  ('causes', 'prowadzi_do'),
  ('obejmuje', 'zawiera'),
  ('obejmują', 'zawiera'),
  ('zawierają', 'zawiera'),
  ('spożywa', 'spozywa'),
  ('je', 'spozywa'),
  ('poprawia', 'wspiera'),
  ('zwiększa', 'wspiera'),
  ('wspomaga', 'wspiera'),
  ('wspierają', 'wspiera'),
  ('redukuje', 'oslabia'),
  ('relaksuje', 'wspiera'),
  ('uczestniczy w', 'uczestniczy_w'),
  ('angażuje się w', 'uczestniczy_w'),
  ('angażuje_się_w', 'uczestniczy_w'),
  ('był na', 'uczestniczy_w'),
  ('idzie na', 'uczestniczy_w'),
  ('obserwuje', 'analizuje'),
  ('analizuje', 'analizuje'),
  ('posiada cechę', 'posiada'),
  ('pracuje nad', 'pracuje_nad'),
  ('pracuje_nad', 'pracuje_nad'),
  ('wskazuje na', 'wskazuje_na'),
  ('wykazuje', 'wskazuje_na'),
  ('jest alternatywą dla', 'jest_alternatywa_dla'),
  ('jest celem', 'chce'),
  ('ma egzamin', 'ma_egzamin'),
  ('has exam on', 'ma_egzamin'),
  ('ma wskaźnik', 'ma_wskaznik'),
  ('musi', 'wymaga'),
  ('musi zdać', 'wymaga'),
  ('powinien rozwijać', 'wymaga'),
  ('preferuje', 'preferuje'),
  ('ceni', 'preferuje'),
  ('prowadzi', 'prowadzi_do'),
  ('udziela rady', 'udziela_rady'),
  ('monitorowane przez', 'monitoruje'),
  ('nawiązuje kontakt z', 'nawiazuje_kontakt_z'),
  ('ma nawyk', 'ma_nawyk'),
  ('ma tendencję do', 'ma_tendencje_do'),
  ('zmienia', 'zmienia'),
  ('aktualizuje', 'zmienia'),
  ('chroni', 'chroni'),
  ('zapobiegają', 'chroni'),
  ('jest_narzędziem_do', 'jest_narzedziem_do'),
  ('zlokalizowany w', 'mieszka_w'),
  ('uczy', 'uczy_sie'),
  ('uczy_sie', 'uczy_sie'),
  ('wybiera', 'preferuje'),
  ('zapewnia', 'wspiera'),
  ('zapisuje', 'pamieta');

CREATE TEMP TABLE tmp_relation_candidates AS
SELECT
  el.*,
  coalesce(rm.new_relation, el.relation) AS new_relation
FROM public.vanguard_entity_links el
LEFT JOIN tmp_relation_map rm ON rm.old_relation = el.relation
WHERE rm.old_relation IS NOT NULL
   OR EXISTS (
        SELECT 1
        FROM public.vanguard_entity_links old_el
        JOIN tmp_relation_map old_rm ON old_rm.old_relation = old_el.relation
        WHERE old_el.user_id = el.user_id
          AND old_el.source_entity = el.source_entity
          AND old_rm.new_relation = el.relation
          AND old_el.target_entity = el.target_entity
      );

CREATE TEMP TABLE tmp_relation_groups AS
SELECT
  user_id,
  source_entity,
  new_relation,
  target_entity,
  (array_agg(id ORDER BY (relation = new_relation) DESC, evidence_count DESC, id))[1] AS survivor_id,
  array_agg(id) AS all_ids,
  sum(evidence_count) AS evidence_count_sum,
  max(weight) AS max_weight,
  min(first_seen) AS min_first_seen,
  max(last_seen) AS max_last_seen,
  max(confidence_score) AS max_confidence_score,
  max(observed_at) AS max_observed_at,
  bool_or(status = 'active') AS has_active
FROM tmp_relation_candidates
GROUP BY user_id, source_entity, new_relation, target_entity;

DELETE FROM public.vanguard_entity_links el
USING tmp_relation_groups g
WHERE el.id = ANY(g.all_ids)
  AND el.id <> g.survivor_id;

UPDATE public.vanguard_entity_links el
SET
  relation = g.new_relation,
  evidence_count = greatest(el.evidence_count, g.evidence_count_sum),
  weight = least(5.0, greatest(el.weight, g.max_weight)),
  first_seen = coalesce(g.min_first_seen, el.first_seen),
  last_seen = coalesce(g.max_last_seen, el.last_seen),
  observed_at = coalesce(g.max_observed_at, el.observed_at),
  status = CASE WHEN g.has_active THEN 'active' ELSE el.status END,
  valid_until = CASE WHEN g.has_active THEN NULL ELSE el.valid_until END,
  confidence_score = greatest(el.confidence_score, g.max_confidence_score),
  metadata = coalesce(el.metadata, '{}'::jsonb) || jsonb_build_object(
    'relation_normalized_at', now(),
    'relation_normalized_to', g.new_relation
  )
FROM tmp_relation_groups g
WHERE el.id = g.survivor_id;
