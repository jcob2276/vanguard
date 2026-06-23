# ETAP 1 — Behavioral Pattern Detection Engine

> Plik przekazywany między agentami AI. Każdy agent czyta **cały plik** przed pracą,
> wykonuje swoją fazę, a potem **dopisuje log** na końcu sekcji „Dziennik wykonania".
> Następny agent widzi co było zrobione i nie powtarza pracy.

---

## KONTEKST PROJEKTU

**Vanguard OS** — osobisty system operacyjny Jakuba.

**Stack:**
- Frontend: React 19 + TypeScript + Vite + TailwindCSS 4
- Backend: Supabase (PostgreSQL + Auth + RLS + Edge Functions na Deno)
- AI: DeepSeek, edge function `vanguard-oracle`
- Komunikacja: Telegram bot (`vanguard-telegram`)
- Repo: `C:\Users\jakub\Desktop\Vanguard`

**Nienaruszalne zasady:**
- Timezone: zawsze `Europe/Warsaw`, nigdy `new Date()` bez timeZone
- Supabase: zawsze `createServiceClient()` + `resolveUserScope()`
- `unwrap()` tylko dla zapytań z `.select()`
- Po `insert/update` bez `.select()` — sprawdzaj `{ error }` ręcznie

**Źródła spec:**
- `docs/direction/ETAP_1_BACKLOG.md` — pełny backlog wzorców
- `docs/direction/ETAP_1_RESEARCH_WZORCE_ISTNIEJACE_DANE.md` — co jest wykrywalne
- `docs/direction/ETAP_1_INTERFEJSY_WZORCE_PROPOZYCJE.md` — UI wzorców

---

## CEL ETAPU 1

Zbudować system który wykrywa powtarzalne wzorce behawioralne z istniejących danych
i pokazuje je użytkownikowi w miejscach gdzie już jest (Oracle, brief, reconciliation).

**Filozofia:**
- Evidence first. Wzorce = powtarzalne relacje między sygnałami, nie interpretacje.
- Język wyłącznie dowodowy: "u Ciebie", "N=14", "w 9 na 13 przypadków", nigdy "powinieneś".
- Najpierw iniekcje tekstowe do istniejących flow. Zero nowych ciężkich UI na start.
- "Confirmed pattern" wymaga minimalnego N (≥7) i progu pewności (≥0.55).

---

## STATUS FAZ

| Faza | Nazwa | Status | Agent | Data |
|---|---|---|---|---|
| 1 | DB — tabela wzorców | ⬜ TODO | — | — |
| 2 | Edge fn detect-patterns (detektory S1–S4) | ⬜ TODO | — | — |
| 3 | Oracle context injection | ⬜ TODO | — | — |
| 4 | Morning brief + reconciliation injection | ⬜ TODO | — | — |
| 5 | React Pattern Card + feedback UI | ⬜ TODO | — | — |

Statusy: ⬜ TODO → 🔄 IN PROGRESS → ✅ DONE → ⚠️ PARTIAL

---

## FAZA 1 — DB: tabela wzorców + migracja

**Cel:** Stworzyć tabelę `vanguard_behavioral_patterns` i tabele pomocnicze.

**Pliki do utworzenia:**
- `supabase/migrations/20260623220000_behavioral_patterns.sql`

**Schema:**
```sql
CREATE TABLE vanguard_behavioral_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type text NOT NULL,
  -- 'recurring_blocker' | 'morning_protocol_impact' | 'sleep_friction_correlation'
  -- | 'plan_adherence' | 'state_sequence' | 'narrative_vs_data'
  signature text NOT NULL,
  -- krótki unikalny id np. "sleep<6h→procrastination"
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  -- { n_days: int, strength: float, conditions: {}, outcomes: {}, examples: [stream_ids] }
  first_seen date,
  last_seen date,
  occurrence_count int DEFAULT 0,
  avg_impact numeric,          -- delta execution_score lub identity_score
  confidence numeric,          -- 0.0–1.0
  status text DEFAULT 'hypothesis',
  -- 'hypothesis' | 'visible' | 'user_confirmed' | 'user_rejected' | 'archived'
  user_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE vanguard_behavioral_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON vanguard_behavioral_patterns
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Indexes
CREATE INDEX ON vanguard_behavioral_patterns (user_id, status);
CREATE INDEX ON vanguard_behavioral_patterns (user_id, pattern_type);
CREATE UNIQUE INDEX ON vanguard_behavioral_patterns (user_id, signature);

-- Pattern feedback
CREATE TABLE vanguard_pattern_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id uuid REFERENCES vanguard_behavioral_patterns(id) ON DELETE CASCADE,
  feedback text NOT NULL, -- 'confirmed' | 'rejected' | 'observe'
  created_at timestamptz DEFAULT now()
);
ALTER TABLE vanguard_pattern_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON vanguard_pattern_feedback
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Iron rules (statyczny kontekst dla Oracle)
CREATE TABLE vanguard_iron_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_key text NOT NULL,        -- 'marathon_goal', 'sleep_target' itd.
  rule_text text NOT NULL,       -- "Celem jest Maraton 4:10 na 2026-10-04"
  active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE vanguard_iron_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner" ON vanguard_iron_rules
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE UNIQUE INDEX ON vanguard_iron_rules (user_id, rule_key);
```

---

## FAZA 2 — Edge fn: detect-patterns (detektory S1–S4)

**Cel:** Edge function `vanguard-detect-patterns` którą można wywołać manualnie (lub cron)
żeby wykryć wzorce i zapisać/zaktualizować je w `vanguard_behavioral_patterns`.

**Plik:** `supabase/functions/vanguard-detect-patterns/index.ts`

**Detektory (w kolejności implementacji):**

### Detektor S1: Recurring Blockers

- Źródło A: `daily_reconciliations.p2_parsed->>'blocker_candidates'` (JSONB array)
- Źródło B: `friction_events` gdzie `created_at` w zakresie D+1..D+7 i `event_kind='friction_event'`
- Metoda: dla każdego unikalnego blockera (lowercase/trim) — ile razy pojawia się, ile razy po nim friction
- Próg: N ≥ 7 wieczorów z tym blockerem; strength = friction_count / total_blocker_count ≥ 0.55
- Output: `pattern_type='recurring_blocker'`, `signature='blocker:{blocker_normalized}'`

### Detektor S2: Morning Protocol Impact

- Źródło A: `daily_reconciliations.operational_facts->>'first_90_protected'` (bool),
  `->>'phone_first'` (bool)
- Źródło B: `vanguard_daily_aggregates.execution_score` następnego dnia (date +1)
- Źródło C: personal baseline z agregatu (avg execution_score 90d)
- Metoda: t-test-like (prostszy: avg gdy phone_first=true vs avg gdy false, delta vs baseline)
- Próg: N ≥ 8 dni po obu stronach
- Output: `pattern_type='morning_protocol_impact'`, `signature='phone_first→execution_delta'`

### Detektor S3: Sleep → Friction Type

- Źródło A: `vanguard_daily_aggregates.total_sleep` (godziny, z Oura)
- Źródło B: `friction_events.friction_type` następnego dnia (event_kind='friction_event')
- Metoda: binowanie snu (<6 / 6-7 / >7) → rozkład friction_type. Top friction w każdym binie.
- Próg: N ≥ 10 dni z danymi obu stron
- Output: `pattern_type='sleep_friction_correlation'`, `signature='sleep<6h→{top_friction}'`

### Detektor S4: Plan Adherence

- Źródło A: `daily_reconciliations.planning_summary` (production_artifact, tension_action jako stringi)
- Źródło B: `daily_reconciliations.p2_parsed->>'biggest_cost'`, `->>'day_score'`
- Źródło C: `friction_events` następnego dnia
- Metoda: czy artifact mention pojawia się w p2_parsed/stream; tension_action zrobiony vs nie;
  friction count następnego dnia
- Próg: N ≥ 7 par plan+wieczór
- Output: `pattern_type='plan_adherence'`, `signature='plan_vs_reality_adherence'`

**HTTP API edge function:**
```
POST /vanguard-detect-patterns
Body: { user_id?: string }  -- jeśli brak, użyj VANGUARD_USER_ID
Returns: { patterns_found: int, patterns_updated: int, patterns_skipped: int, details: [...] }
```

---

## FAZA 3 — Oracle context injection

**Cel:** Gdy Oracle dostaje pytanie o "ostatnio"/"trend"/"dlaczego"/"wzorzec", inject
top 2-3 wzorce z `vanguard_behavioral_patterns` (status IN ('visible','user_confirmed'))
jako dodatkowy blok kontekstu w system prompcie.

**Plik do modyfikacji:** `supabase/functions/vanguard-oracle/index.ts`

**Logika:**
1. Pobierz top 3 wzorce (ORDER BY confidence DESC, last_seen DESC, status='visible' OR 'user_confirmed')
2. Jeśli pytanie zawiera słowa kluczowe → inject blok `## WZORCE BEHAWIORALNE UŻYTKOWNIKA`
3. Format każdego wzorca: `- {description} (N={n_days}, pewność={confidence:.0%}, ostatnio: {last_seen})`

**Słowa kluczowe triggery:** ostatnio, trend, dlaczego, wzorzec, schemat, pattern, powtarza,
zawsze, często, kiedy, dawniej, wcześniej, history, historycznie

**Nowy helper:** `supabase/functions/_shared/patternContext.ts`

---

## FAZA 4 — Morning brief + reconciliation injection

**Cel:** Wstrzyknąć 1-2 najsilniejsze wzorce do:
1. Morning brief (sekcja po "Pierwszy blok", przed "Artefaktem")
2. Wieczorne reconciliation (na końcu bridge message po reconciliation)

**Pliki do modyfikacji:**
- `supabase/functions/vanguard-morning-brief/index.ts` (jeśli istnieje) lub `vanguard-daily-reconciliation`
- `supabase/functions/vanguard-daily-reconciliation/index.ts`

**Format wstrzykiwania (Pattern Bridge):**
```
---

📊 *W Twoich danych ten schemat się powtarza:*

{pattern.description}
_(N={n}, ostatnio {last_seen}_)
```

**Triggery:**
- Morning brief: zawsze (jeśli wzorce istnieją z confidence ≥ 0.65, N ≥ 8)
- Reconciliation: gdy `p2_parsed.blocker_candidates` zawiera blocker który jest w `signature`

---

## FAZA 5 — React Pattern Card + feedback UI

**Cel:** Komponent `PatternCard` wyświetlający wzorzec + przyciski feedback.
Strona `/patterns` (lub sekcja w Insights) pokazująca wszystkie wzorce.

**Pliki do utworzenia:**
- `src/components/insights/PatternCard.tsx`
- `src/components/insights/PatternsView.tsx`

**PatternCard format:**
```
[EMOJI] Wzorzec (N={n}, ostatnie {weeks} tygodni)

Kiedy {condition} → w {pct}% przypadków {outcome}

Ostatni raz: {last_seen}. Pewność: {confidence:.0%}

[ ✓ To ma sens ]  [ ✗ To nie moje ]  [ 👁 Obserwuj ]
```

Feedback przyciski → POST do Supabase `vanguard_pattern_feedback` + update `status` wzorca.

**Routing:** dodaj `/patterns` do nawigacji (lub jako zakładka w InsightsDashboard).

---

## DZIENNIK WYKONANIA

<!-- Agent dopisuje log po każdej fazie -->
