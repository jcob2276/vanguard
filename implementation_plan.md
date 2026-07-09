# Plan Wdrożenia: Resolution Layer (Partner Mode)

> **Hard Freeze:** obowiązuje do 10 lipca 2026, 17:00 UTC. Zakaz zmian w kodzie produkcyjnym i w `vanguard-auto-classify` do tego czasu. Ten dokument to gotowa specyfikacja do wykonania natychmiast po zdjęciu blokady.

## Cel

Telegram ma przestać być pasywnym Loggerem (surowe transkrypcje) i stać się Partnerem: przed odpowiedzią bot sprawdza graf faktów (`public.claims`) i stan biometryczny (Oura), więc odpowiedź odnosi się do realnego kontekstu, nie generuje generycznego tekstu.

Warunek konieczny: graf encji (`entities`/`entity_aliases`/`claims`) musi być spójny — jedna realna rzecz = jedna encja. Dziś tak nie jest (patrz Krok 0).

## Krok 0 — Diagnoza (zweryfikowana bezpośrednio w bazie, projekt `pdvqkgfsqziqlhptatgf`)

- `entities`: 232 wiersze, wszystkie utworzone 2026-07-08.
- `entity_aliases`: **0 wierszy.** Trigger `tr_new_entity_alias` istnieje, ale te 232 encje powstały zanim/bez tego by trigger je zasilił → Tier 1 (trigram) nie ma dziś na czym trafić.
- Znalezione duplikaty (potwierdzone przez zgodność `kind` + wysokie podobieństwo):
  - `Cyberbezpieczenstwo` (concept) / `Cyberbezpieczeństwo` (inne) — sim 0.74
  - `Kinga` (person) / `Kuzynka Kinga` (person) — sim 0.46
- Fałszywe alarmy odrzucone po sprawdzeniu `kind` (NIE scalać):
  - `Analiza` (concept) / `Analiza Danych` (education) / `Analityk Danych` (role) — trzy różne pojęcia
  - `Siłownia` (place) / `siłownia_jutro`, `siłownia_w_sobotę`, `siłownia_w_niedzielę` (event) — miejsce vs wydarzenia w tym miejscu
- Istniejący cotygodniowy cron `vanguard-sunday-cleanup` (`SELECT public.vanguard_graph_cleanup()`, niedziela 5:00) używa progu podobieństwa 0.85 — nie złapie żadnego z dwóch potwierdzonych duplikatów powyżej (0.74 i 0.46 < 0.85). Zostaje bez zmian jako osobna siatka bezpieczeństwa dla oczywistych literówek; nie jest to samo narzędzie co poniższe kroki.

## Krok 1 — Backfill `entity_aliases` (jednorazowy, mechaniczny)

```sql
INSERT INTO public.entity_aliases (entity_id, alias)
SELECT id, canonical_name FROM public.entities
ON CONFLICT (entity_id, alias) DO NOTHING;
```
Bezpieczne i idempotentne (`UNIQUE (entity_id, alias)` już istnieje).

## Krok 2 — Ręczny merge 2 potwierdzonych duplikatów

```sql
UPDATE public.entities SET merged_into = '47f9f943-08a1-4a39-9133-63109e810d44' -- Cyberbezpieczenstwo (concept, zostaje)
WHERE id = 'de0ededb-cf17-44fe-a7b0-ed31df20af15'; -- Cyberbezpieczeństwo (inne)

UPDATE public.entities SET merged_into = 'cfb84c19-ddf6-4aef-9a22-7daf3f275e24' -- Kinga (zostaje)
WHERE id = 'c282242f-a44a-4a22-bb03-f3fdd5a94baf'; -- Kuzynka Kinga

INSERT INTO public.entity_aliases (entity_id, alias) VALUES
  ('47f9f943-08a1-4a39-9133-63109e810d44', 'Cyberbezpieczeństwo'),
  ('cfb84c19-ddf6-4aef-9a22-7daf3f275e24', 'Kuzynka Kinga')
ON CONFLICT DO NOTHING;
```
`resolve_entity()` już podąża za `merged_into` rekurencyjnie (krok D) — istniejące `claims` wskazujące na scalone ID nadal będą działać.

**Po krokach 1-2 graf jest uporządkowany na dziś.** Kroki 3-4 poniżej zapobiegają nawrotowi — nie sprzątają niczego wstecz.

## Krok 3 — Guardrail przeciw fragmentacji na przyszłość: `resolve_entity()` krok B2

Wstawić między krokiem B (exact canonical match) a C (create new) w `public.resolve_entity()`:

```sql
-- B2. Fuzzy match po aliasach: kind zgodny, próg 0.7, confidence gap 0.15
IF v_entity_uuid IS NULL THEN
  WITH ranked AS (
    SELECT ea.entity_id, similarity(ea.alias, v_clean_name) AS sim
    FROM public.entity_aliases ea
    JOIN public.entities e ON e.id = ea.entity_id
    WHERE e.user_id = p_user_id
      AND e.kind = p_kind
      AND similarity(ea.alias, v_clean_name) > 0.7
    ORDER BY sim DESC
    LIMIT 2
  ),
  best AS (SELECT * FROM ranked LIMIT 1),
  second AS (SELECT r.sim FROM ranked r, best b WHERE r.entity_id <> b.entity_id LIMIT 1)
  SELECT b.entity_id INTO v_entity_uuid
  FROM best b
  WHERE NOT EXISTS (SELECT 1 FROM second s WHERE b.sim - s.sim < 0.15);
END IF;
```

Guardraile: (1) `kind` musi się zgadzać — odrzuca fałszywe alarmy typu Analiza/Siłownia z Kroku 0; (2) próg 0.7; (3) confidence gap ≥0.15 — jeśli dwóch różnych kandydatów jest blisko siebie, wygrywa ostrożność: tworzymy nową encję zamiast błędnie scalać, logujemy do `audit_events` (`event_type='entity_fuzzy_ambiguous'`).

Dodać indeks: `CREATE INDEX idx_entity_aliases_alias_trgm ON entity_aliases USING gin (alias gin_trgm_ops);`

Bitemporalność nietknięta — B2 tylko zwraca istniejący ID zamiast tworzyć nowy; żaden istniejący wiersz nie jest modyfikowany.

## Krok 4 — Resolution Layer w `queryOracle` (Partner Mode właściwy)

Plik: [messageHelpers.ts:208](supabase/functions/vanguard-telegram/_router/messageHelpers.ts:208), funkcja `queryOracle()`, wywoływana wyłącznie z `OracleResponseInterceptor` gdy `ctx.shouldRespond === true` (wolna rozmowa). **Command handlery (`/lenie`, `/posilek`, `/todo`, `/keep`) zostają bez zmian.**

1. Zamiast ręcznego `Promise.all` na 5 tabelach → `fetchWorldState(supabase, vanguardUserId)` z [_shared/worldState.ts](supabase/functions/_shared/worldState.ts:51) (cache 15 min, już istnieje, nieużywany dziś w tym miejscu).
2. Równolegle: rezolucja encji z `cleanText` (Tier 1 = `resolve_entity` po B2 z Kroku 3; Tier 2 = embedding + top-10 kandydatów + `deepseek-v4-flash`, tylko gdy Tier 1 nie trafi).
3. SELECT z `public.claims` dla rozwiązanej encji (`subject_id`/`object_id`, `status='active'`).
4. Zbudowany kontekst (world state + claims + entity) → prompt do `vanguard-oracle` z instrukcją epistemiczną: brak danych = brak zmyślania, krótki rzeczowy komunikat.

## Kolejność wykonania (po zdjęciu freeze)

1. Migracja: backfill aliasów + 2 merge'e (Krok 1-2)
2. Migracja: B2 w `resolve_entity()` + indeks GIN (Krok 3)
3. Deploy edge function: `queryOracle` z Resolution Layer + `fetchWorldState` (Krok 4)

## Otwarte pytania — rozstrzygnięte w toku rozmowy

- Próg trigramów Tier 1: **0.7** (kompromis, z guardrailem confidence-gap zamiast czystego progu).
- `vanguard_graph_cleanup()` (cotygodniowy cron): zostaje bez zmian, osobna siatka bezpieczeństwa, próg 0.85 celowo wyższy/luźniejszy.
