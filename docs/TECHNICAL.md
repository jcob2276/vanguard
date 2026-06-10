# Vanguard OS — Technical Reference

> **STALE — verify against [AGENTS.md](../AGENTS.md), [vanguard-core.md](./vanguard-core.md), and [supabase/functions/README.md](../supabase/functions/README.md) before trusting details below.**

> Dla developera który zna projekt. Nie intro, nie tutorial.  
> Stan na: 2026-05-26. Sprint 0.8+ — pełna pętla dzienna + Strava + trening.
> **⚠️ Sekcja 1.3 (function list) i Sekcja 8 (Known Issues) są częściowo nieaktualne. SSOT: [`supabase/functions/README.md`](../supabase/functions/README.md)**

---

## 1. Architektura systemu

### 1.1 Przepływ danych — główna ścieżka

```
Telegram (głos/tekst)
  └─► vanguard-telegram
        ├─► vanguard_stream (INSERT)
        │     └─► tr_vanguard_auto_classify [trigger AFTER INSERT]
        │           └─► vanguard-auto-classify
        │                 ├─► DeepSeek: klasyfikacja (kategoria, importance, fingerprint)
        │                 ├─► DeepSeek: friction detection
        │                 ├─► OpenAI: embedding (situation_fingerprint)
        │                 ├─► friction_events (INSERT, jeśli is_friction=true)
        │                 └─► vanguard_stream_closure_proposals (INSERT, jeśli is_closure=true)
        │                       [NIE pisze do vanguard_stream.valid_until — human gate]
        │
        ├─► vanguard-oracle (jeśli ? lub !! prefix)
        │     ├─► OpenAI: query embedding
        │     ├─► match_vanguard_content RPC (4-source hybrid retrieval)
        │     ├─► search_entity_links RPC
        │     ├─► find_entity_seeds_by_embedding RPC [⚠️ MISSING — patrz §5]
        │     ├─► find_mentioned_entities RPC
        │     ├─► get_vanguard_graph_context RPC
        │     └─► DeepSeek: final answer
        │
        ├─► ingest-vault-log (jeśli voice > 120 słów lub ## prefix)
        │     ├─► OpenAI: chunk embeddings
        │     └─► DeepSeek: triad extraction → vanguard_entity_links
        │
        └─► vanguard-architect (deferred, EdgeRuntime.waitUntil)
              └─► DeepSeek: triad extraction → vanguard_entity_links
```

### 1.2 Ścieżki cron / async

```
pg_cron 0 4 * * *  (UTC)  →  trigger_daily_snapshots()
                                └─► save-daily-aggregate
                                      └─► vanguard_daily_aggregates (UPSERT)

pg_cron 0 3 * * *  (UTC)  →  vanguard-analyst  [⚠️ DWIE instancje — patrz §5]
                                ├─► DeepSeek Reasoner: friction pattern analysis
                                ├─► vanguard_curiosity_queue (UPDATE evaluated)
                                └─► vanguard_curiosity_queue (INSERT new candidates)

pg_cron 0 0 * * 0  (UTC)  →  vanguard-intentions-cleanup
                                └─► DeepSeek: audit active intentions
                                      └─► vanguard_intentions (UPDATE status)

pg_cron 30 20 * * * (UTC) →  sync-strava
                                └─► strava_activities (upsert)

Brak cron (HTTP manual):
  vanguard-briefing     →  DeepSeek → Telegram
  vanguard-backfill     →  OpenAI embeddings backfill
  vanguard-graph-embedder
  vanguard-debug-retrieval
  vanguard-eval-runner
  vanguard-friction-qa
  analyze-training      →  DeepSeek plan vs Strava → Telegram
  sync-oura / sync-yazio / sync-todoist / sync-calendar
```

### 1.3 Edge functions — aktywne vs wyłączone

| Funkcja | Status | Trigger | Uwagi |
|---------|--------|---------|-------|
| vanguard-auto-classify | ✅ aktywna | webhook INSERT vanguard_stream | |
| vanguard-briefing | ✅ aktywna | HTTP manual / cron Dashboard | |
| vanguard-oracle | ✅ aktywna | HTTP (z telegram) | write access DISABLED |
| vanguard-analyst | ✅ aktywna | cron `0 3 * * *` | ⚠️ 2 cronjobы |
| vanguard-architect | ✅ aktywna | HTTP (z telegram, deferred) | friction pipeline DISABLED |
| vanguard-telegram | ✅ aktywna | Telegram webhook | |
| vanguard-intentions-cleanup | ✅ aktywna | cron `0 0 * * 0` | |
| save-daily-aggregate | ✅ aktywna | cron `0 4 * * *` | |
| vanguard-backfill | ✅ aktywna | HTTP manual | |
| vanguard-graph-embedder | ✅ aktywna | HTTP manual | |
| ingest-vault-log | ✅ aktywna | HTTP (z telegram) | |
| vanguard-friction-qa | ✅ aktywna | HTTP manual | |
| vanguard-eval-runner | ✅ aktywna | HTTP manual | gpt-5-mini bug |
| vanguard-debug-retrieval | ✅ aktywna | HTTP manual | |
| sync-oura / sync-yazio / sync-todoist / sync-calendar | ✅ aktywne | HTTP manual | |
| sync-strava | ✅ aktywna | pg_cron `30 20 * * *` / HTTP manual | tokeny w strava_tokens (rotacja auto) |
| analyze-training | ✅ aktywna | HTTP manual | plan vs Strava DeepSeek analysis → Telegram |
| sync-google-fit | ⚠️ deprecated | HTTP manual | superseded by Strava; UI caller usunięty ze Stats.jsx 2026-05-26 |
| google-fit-auth | ⚠️ deprecated | HTTP GET (OAuth callback) | superseded by Strava |
| weekly-report | ❌ nie istnieje | — | ghost — brak folderu; legacy PDF raport nigdy nie wdrożony |
| vanguard-daily-reconciliation | ✅ aktywna | pg_cron | **false** JWT |
| vanguard-reset-prompt | ⛔ deprecated | HTTP → 410; cron off 2026-05-23 | **false** JWT |
| vanguard-morning-brief / vanguard-midday-check | ✅ aktywne | pg_cron | **false** JWT |

**Wyłączone bloki w aktywnych funkcjach:**

- `vanguard-architect`: `extractFrictionEvent` **usunięte** (2026-05-26) — friction tylko przez `vanguard-auto-classify`.
- `vanguard-oracle`: zapis do `vanguard_knowledge` / `entity_links` na turnie czatu **wyłączony** (audit log synchroniczny).
- `vanguard-analyst`: pattern_candidate promotion **wyłączona** (~linia 260). Re-enable po Sprint 1 + QA friction precision.
- `vanguard-reset-prompt`: **deprecated** — zwraca 410; migracja `20260526100000_unschedule_reset_prompt.sql`.

### 1.4 Cron jobs

| Nazwa (pg_cron) | Schedule (UTC) | Czas PL (lato CEST) | Funkcja | Żyje od |
|-----------------|----------------|---------------------|---------|---------|
| vanguard-daily-snapshot | `0 4 * * *` | 06:00 | save-daily-aggregate | 20260513 |
| vanguard-daily-analyst | `0 3 * * *` | 05:00 | vanguard-analyst | 20260513 (mig. 008) |
| vanguard-daily-shadow-analysis | — | — | — | **USUNIĘTY** (mig. 20260525170000) |
| vanguard-morning-brief | `0 5 * * *` | 07:00 | vanguard-morning-brief | 20260521 |
| vanguard-morning-ping | `20 5 * * *` | 07:20 | vanguard-morning-ping | 20260524 |
| vanguard-weekly-intentions-cleanup | `0 0 * * 0` | 02:00 niedziela | vanguard-intentions-cleanup | 20260513 (mig. 006) |

---

## 2. Schema bazy danych

### 2.1 Tabele rdzenne (stworzone poza migracjami lub pre-existing)

Następujące tabele istnieją w bazie ale nie mają DDL w `/supabase/migrations/`:

| Tabela | Znane kolumny (z kodu) | Status RLS |
|--------|------------------------|------------|
| `vanguard_stream` | id, user_id, content, source, category, embedding, importance_score, tags, situation_fingerprint (vector 1536), valid_from, valid_until, classification, metadata, created_at | ENABLED (mig. 008) |
| `vanguard_knowledge` | id, user_id, title, content, category, importance_score, is_verified, embedding (vector), metadata, valid_until, created_at | ENABLED (mig. 008) |
| `vanguard_daily_aggregates` | user_id, date, final_state, execution_score, sleep_hours, hrv_avg, readiness_score, dopamine_load_index, fragmentation_index, screen_time_min, identity_score, state_confidence | ENABLED (mig. 008) |
| `daily_wins` | id, user_id, date, done_1..5, completed_at_1..5, daily_rpe, journal_entry, gratitude_entry, mood_score, tags, result | ENABLED (mig. 008) |
| `daily_nutrition` | user_id, date, calories, protein | nieznane |
| `user_fundament` | user_id, identity, philosophy, vision | nieznane |
| `user_settings` | user_id, todoist_token, google_fit_refresh_token, google_fit_client_id | nieznane |
| `stayfree_usage` | user_id, date, app_name, device_name, duration_seconds, unlocks | DEPRECATED / no active caller |
| `oura_daily_summary` | user_id, date, readiness_score, hrv_avg, rhr_avg, total_sleep_hours, deep_sleep_hours, rem_sleep_hours, sleep_efficiency, latency_minutes, bedtime_timestamp, steps, active_calories, total_calories, temp_deviation | nieznane |
| `body_metrics` | id, weight_italia | nieznane (pre-existing) |

### 2.2 Tabele z migracjami

#### `vanguard_entity_links`
Migracja bazowa: `20260512000000`. Rozszerzana przez 9 kolejnych migracji.

| Kolumna | Typ | Default | Nullable | Constraint |
|---------|-----|---------|----------|------------|
| id | uuid | gen_random_uuid() | NO | PK |
| user_id | uuid | — | YES | FK → auth.users |
| source_entity | text | — | NO | |
| source_type | text | — | NO | |
| relation | text | — | NO | FK → vanguard_relation_ontology(relation) NOT VALID |
| target_entity | text | — | NO | |
| target_type | text | — | NO | |
| weight | float | 1.0 | YES | max 5.0 |
| first_seen | date | CURRENT_DATE | YES | |
| last_seen | date | CURRENT_DATE | YES | |
| evidence_count | integer | 1 | YES | |
| layer | text | 'intelligence' | YES | |
| valid_from | timestamptz | now() | YES | |
| valid_until | timestamptz | — | YES | |
| observed_at | timestamptz | now() | YES | |
| status | text | 'active' | YES | CHECK IN (active,historical,disputed,deprecated) |
| confidence_score | double precision | 0.6 | YES | CHECK 0-1 |
| memory_type | text | 'fact' | YES | CHECK IN (fact,hypothesis,preference,correlation,telemetry) |
| superseded_by | uuid | — | YES | FK → self DEFERRABLE INITIALLY DEFERRED |
| metadata | jsonb | '{}' | YES | |
| source_episode_id | uuid | — | YES | |
| temporal_status | text | 'current' | YES | CHECK IN (current,historical,declared,hypothesis,stale,unknown) |
| created_at | timestamptz | timezone('utc',now()) | YES | |

**UNIQUE:** `(user_id, source_entity, relation, target_entity)`

**RLS:** ENABLED — `"Users own their links"` FOR ALL `auth.uid() = user_id`

**Indexes:** idx_entity_links_user_source, idx_entity_links_user_target, idx_entity_links_source_trgm (GIN), idx_entity_links_target_trgm (GIN), idx_entity_links_active_lookup `(user_id, status, layer, source_entity, target_entity) WHERE valid_until IS NULL`, idx_entity_links_metadata (GIN)

**Trigger:** `trigger_check_vanguard_relation` BEFORE INSERT OR UPDATE OF relation — blokuje relacje spoza ontologii (EXCEPTION)

**RPCs operujące na tej tabeli:** upsert_vanguard_entity_link (12-arg + 10-arg shim), get_vanguard_graph_context (7-arg), find_mentioned_entities, search_entity_links, canonicalize_vanguard_entity, vanguard_graph_cleanup

---

#### `friction_events`
Migracja: `20260516000001`.

| Kolumna | Typ | Default | Nullable | Constraint |
|---------|-----|---------|----------|------------|
| id | uuid | gen_random_uuid() | NO | PK |
| user_id | uuid | — | NO | |
| stream_record_id | uuid | — | YES | FK → vanguard_stream(id) ON DELETE SET NULL |
| occurred_at | timestamptz | now() | NO | |
| raw_text | text | — | YES | |
| friction_type | text | — | YES | CHECK IN (avoidance, procrastination, emotional_spike, habit_break, social_withdrawal, sleep_disruption, other) |
| context | jsonb | '{}' | YES | |
| cost_estimate | text | — | YES | |
| confidence_source | text | 'self_report' | YES | CHECK IN (self_report, inferred, biometric) |
| confidence | float | 0.7 | YES | CHECK 0-1 |
| created_at | timestamptz | now() | YES | |

**⚠️ SCHEMA MISMATCH:** auto-classify wstawia kolumny których nie ma w DDL: `declared_intention`, `actual_behavior`, `deviation`, `immediate_cost`, `emotional_state`, `people_involved`, `location_context`, `status='raw'`. Insertu nie blokuje tylko jeśli kolumny istnieją — prawdopodobnie zostały dodane przez `ALTER TABLE` poza migracjami.

**⚠️ friction_type MISMATCH:** DDL nie zawiera: training_drop, social_hesitation, communication_drift, self_control_break, positive_micro_action — auto-classify je wstawia.

**RLS:** ENABLED
- `"Users see own friction events"` FOR ALL `user_id = auth.uid()`
- `"Service role bypass friction_events"` FOR ALL TO service_role

**Indexes:** `idx_friction_events_user_occurred` ON `(user_id, occurred_at DESC)`, `idx_friction_events_type` ON `(user_id, friction_type)`

---

#### `vanguard_intentions`
Migracja: `20260513000000`.

| Kolumna | Typ | Default | Constraint |
|---------|-----|---------|------------|
| id | UUID | gen_random_uuid() | PK |
| user_id | UUID | — | FK → auth.users ON DELETE CASCADE |
| text | TEXT | — | NOT NULL |
| type | TEXT | 'slide' | CHECK IN (slide,prayer,affirmation,career,goal) |
| status | TEXT | 'active' | CHECK IN (active,manifested,released) |
| importance | INTEGER | 5 | CHECK 1-10 |
| notes | TEXT | — | |
| created_at | TIMESTAMPTZ | NOW() | |
| manifested_at | TIMESTAMPTZ | — | |

**✅ FIXED (2026-05-26):** Oracle queries `.eq('status', 'active')` — poprawna kolumna, intentions pobierane prawidłowo.

**RLS:** ENABLED — `"Users manage own intentions"` FOR ALL `auth.uid() = user_id`

---

#### `vanguard_feedback`
Migracja: `20260513000002`.

| Kolumna | Typ | Notes |
|---------|-----|-------|
| id | UUID PK | |
| user_id | UUID | FK → auth.users |
| message_id | TEXT | Telegram message ID |
| query | TEXT | |
| reply | TEXT | |
| score | INTEGER | 1=👍, -1=👎 |
| correction | TEXT | |
| metadata | JSONB | model, czas |
| created_at | TIMESTAMPTZ | |

**RLS:** ENABLED od `20260519000002`
- `"Users see own feedback"` FOR ALL `user_id = auth.uid()`
- `"Service role bypass feedback"` FOR ALL TO service_role

---

#### `vanguard_curiosity_queue`
Migracja: `20260513000007`.

| Kolumna | Typ | Constraint |
|---------|-----|------------|
| id | UUID PK | |
| user_id | UUID | FK → auth.users ON DELETE CASCADE |
| hypothesis | TEXT | NOT NULL |
| provocation | TEXT | NOT NULL |
| confidence_score | FLOAT | CHECK 0-1 |
| category | TEXT | default 'psychology' |
| evidence_count | INTEGER | default 1 |
| status | TEXT | default 'pending' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS:** ENABLED od `20260519000002`
- `"Users see own curiosity queue"` FOR ALL `user_id = auth.uid()`
- `"Service role bypass curiosity_queue"` FOR ALL TO service_role

**Index:** `idx_vanguard_curiosity_confidence` ON `(confidence_score DESC)` WHERE `status = 'pending'`

---

#### `vanguard_oracle_runs`
Migracja: `20260513000018`.

Kolumny: id, user_id, query, intent, answer, confidence (TEXT), claims (JSONB), sources (JSONB), retrieved_context (JSONB), state_vector (JSONB), created_at.

**RLS:** ENABLED — `"Users own oracle runs"` + `"Service role bypass oracle_runs"` (mig. 008)

---

#### `vanguard_stream_closure_proposals`
Migracja: `20260519000001`.

| Kolumna | Typ | Constraint |
|---------|-----|------------|
| id | UUID PK | |
| user_id | UUID | NOT NULL |
| proposed_by_record_id | UUID | FK → vanguard_stream ON DELETE SET NULL |
| target_record_ids | UUID[] | NOT NULL |
| closed_topic_description | TEXT | NOT NULL |
| similarity_threshold | FLOAT | NOT NULL DEFAULT 0.65 |
| status | TEXT | NOT NULL DEFAULT 'pending', CHECK IN (pending,approved,rejected) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| resolved_at | TIMESTAMPTZ | |

**RLS:** ENABLED — user + service_role bypass

---

#### `vanguard_relation_ontology`
Migracja: `20260514000007`. 35 relacji kanonicznych + 34 ASCII/dodatkowe z kolejnych migracji (łącznie ~69 relacji).

Brak user_id — tabela referencyjna.

**RLS:** ENABLED od `20260519000002` — SELECT dla authenticated, ALL dla service_role.

---

#### `vanguard_singleton_relations`
Migracja: `20260514000009`. 10+3 singleton relations.

Brak user_id — tabela referencyjna.

**RLS:** ENABLED od `20260519000002` — SELECT dla authenticated, ALL dla service_role.

---

#### Pozostałe tabele z migracjami

| Tabela | Migracja | RLS | Uwagi |
|--------|---------|-----|-------|
| `vanguard_preferences` | 20260514000000 | ENABLED | UNIQUE (user_id, key) |
| `vanguard_entity_aliases` | 20260514000001 | ENABLED | UNIQUE (user_id, alias) |
| `vanguard_raw_events` | 20260514000006 | ENABLED | UNIQUE na (user_id,source,source_ref), hash dedup |
| `vanguard_eval_questions` | 20260514000006 | ENABLED | |
| `vanguard_eval_runs` | 20260514000006 | ENABLED | status CHECK updated w mig. 010 |
| `vanguard_eval_results` | 20260514000006 | ENABLED | FK → eval_runs ON DELETE CASCADE |

### 2.3 Widoki

**`confirmed_friction_events`** — referenced in `docs/PRODUCT_PRINCIPLES.md` jako bramka do analizy wzorców. **Widok nie istnieje w migracjach.** Brak `review_status` kolumny w DDL `friction_events`. Status: **PENDING**.

### 2.4 RLS — status wszystkich tabel

| Tabela | RLS | Od migracji |
|--------|-----|-------------|
| vanguard_entity_links | ✅ | 20260512000000 |
| vanguard_intentions | ✅ | 20260513000000 |
| vanguard_oracle_runs | ✅ | 20260513000018 + 008 |
| vanguard_preferences | ✅ | 20260514000000 |
| vanguard_entity_aliases | ✅ | 20260514000001 |
| vanguard_raw_events | ✅ | 20260514000006 + 008 |
| vanguard_eval_questions | ✅ | 20260514000006 |
| vanguard_eval_runs | ✅ | 20260514000006 |
| vanguard_eval_results | ✅ | 20260514000006 |
| friction_events | ✅ | 20260516000001 |
| vanguard_stream_closure_proposals | ✅ | 20260519000001 |
| vanguard_feedback | ✅ | 20260519000002 |
| vanguard_curiosity_queue | ✅ | 20260519000002 |
| vanguard_relation_ontology | ✅ | 20260519000002 |
| vanguard_singleton_relations | ✅ | 20260519000002 |
| vanguard_stream | ✅ | mig. 008 (ALTER) |
| vanguard_knowledge | ✅ | mig. 008 (ALTER) |
| vanguard_daily_aggregates | ✅ | mig. 008 (ALTER) |
| vanguard_footprint | ✅ | mig. 008 (ALTER IF EXISTS) |
| vanguard_correlations | ✅ | mig. 008 (ALTER IF EXISTS) |
| vanguard_temporal_links | ✅ | mig. 008 (ALTER IF EXISTS) |
| daily_wins | ✅ | mig. 20260527000001 |
| daily_nutrition | ✅ | mig. 20260527000001 |
| user_fundament | ✅ | mig. 20260527000001 |
| stayfree_usage | deprecated | no active ingestion path |
| oura_daily_summary | ✅ | mig. 20260527000001 |

---

## 3. Edge functions — szczegóły

### `vanguard-auto-classify`

**Trigger:** `tr_vanguard_auto_classify` AFTER INSERT ON `vanguard_stream` (mig. `20260514000004`)

**Guardy (kolejność wykonania):**
```typescript
// 1. Brak wymaganej treści
if (!record || !record.content || !record.user_id) → 200 "No content to classify"

// 2. Idempotency — ochrona przed webhook retry / double-trigger
if (record.classification && record.importance_score) → 200 "already classified"

// 3. DeepSeek HTTP error (429, 500, timeout)
if (!classifyRes.ok || !frictionRes.ok) → 502 z record_id
```

**Dwa równoległe wywołania DeepSeek** (`Promise.all`):
1. Klasyfikacja: importance_score (1-10), category (Ciało|Konto|Duch|Chaos|Relacje), tags (max 5), fingerprint_text, is_closure, closed_topic_description, expiration_date
2. Friction detection: is_friction, friction_type, declared_intention, actual_behavior, deviation, immediate_cost, emotional_state, people_involved, location_context

**Warsaw date fix** (linia ~35):
```typescript
const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' })
```

**Closure proposals** (linie 199–230): gdy `is_closure=true` i `similarity_threshold=0.65` zwraca matches z `match_vanguard_content` → INSERT do `vanguard_stream_closure_proposals` z `status='pending'`. Nie pisze `valid_until` do `vanguard_stream`.

**confidence: null** (linia ~248): celowe — poprzednia wartość 0.65 była dekoracyjna.

---

### `vanguard-oracle`

**Trigger:** HTTP — wywoływana przez `vanguard-telegram` (timeout 55s) i `vanguard-eval-runner`.

**Retrieval pipeline (HippoRAG-pattern):**

Faza 1 — równolegle:
- `match_vanguard_content` (RAG, threshold 0.35, limit 5)
- semantic graph seeds via `find_entity_seeds_by_embedding` (**⚠️ MISSING RPC**)
- entity seeds via `find_mentioned_entities`

Faza 2 — rozwinięcie seedów:
- `get_vanguard_graph_context` dla każdego znalezionego entity

Faza 3 — re-ranking z temporal penalty:
- stream: weight 1.0
- knowledge: 0.85
- inne: 0.75
- recency: <3d +0.15, 3-21d ±0, 21-60d -0.15, >60d -0.3

**Static context:** user_fundament, vanguard_iron_rules (**brak tabeli**), vanguard_repeated_patterns (**brak tabeli**), vanguard_known_persons (**brak tabeli**), vanguard_preferences, vanguard_intentions (query `.eq('is_active', true)` — **⚠️ zła kolumna, powinno być `status='active'`**)

**DeepSeek model:** `deepseek-v4-flash` (default) lub `deepseek-reasoner` (gdy `thinking=true` — prefix `!!` z telegramu)

**AbortController timeout:** 25s na DeepSeek call.

**Write access:** WYŁĄCZONY (Sprint 0.7). Oracle tylko czyta.

---

### `vanguard-architect`

**Trigger:** HTTP — wywoływany z `vanguard-telegram` przez `EdgeRuntime.waitUntil` (asynchronicznie, nie blokuje odpowiedzi).

**allowedRelations (45 relacji):** jest, posiada, studiuje, pracuje_w, mieszka_w, ma_relacje_z, zna_osobe, chce, dazy_do, unika, boi_sie, prowadzi_do, spowodowane_przez, poprzedza, nastepuje_po, uzywa, tworzy, cwiczy, uczy_sie, deklaruje, czuje, doswiadcza, wynosi, dotyczy, zawiera, wspiera, blokuje, planuje, wymaga, pamieta, osiaga, reaguje_na, wywoluje, wzmacnia, oslabia, pracuje_nad, ma_wspomnienie_z, wskazuje_na, ma_wskaznik, ma_egzamin, analizuje, uczestniczy_w, pracowal_w, studiowal, uczestniczyl_w

**Deterministyczne reguły (25+):** Hardcoded regex-based biographical rules dla znanych encji (babcie, kuzynki, Gavronify, Toastmasters, maraton/Julka Tomon, Pizzeria Alcatras, Collegium Humanum, cel 13% tłuszczu, Dawid Kozluk, rola setera telefonicznego, etc.). Działają jako fallback/augmentacja do LLM extraction.

**Friction extraction:** DEAD CODE — funkcja `extractFrictionEvent()` zdefiniowana (linie 466–545) ale nigdy nie wywoływana (Sprint 0.7 disabled block linie 700–703).

**Hardcoded user_id fallback:** removed for public readiness; use `VANGUARD_USER_ID`.

---

### `vanguard-telegram`

**Authorization:** Tylko wiadomości z `chatId === parseInt(TELEGRAM_CHAT_ID)` są przetwarzane.

**Dedup:** Przed przetworzeniem sprawdza `vanguard_stream.metadata->>'telegram_message_id'` — skip jeśli już istnieje.

**Routing decyzji:**

| Prefix | shouldRespond | Ścieżka |
|--------|---------------|---------|
| `?` | tak | Oracle chat |
| `!!` | tak | Oracle deep (reasoner) |
| `##` | nie | knowledge insert |
| `@` | tak | Oracle mode=mirror |
| `Poprawka:` | nie | knowledge / fundament |
| voice > 120 słów | nie | ingest-vault-log (deferred) |
| inne | nie | vanguard_stream insert |

**Emotion analysis:** DeepSeek, max_tokens=80, zwraca `{valence, arousal, state}` — zapisywane w `vanguard_stream.metadata.emotion`. Failure: warn+skip (nie blokuje insertu).

**Embedding:** OpenAI text-embedding-3-small — failure: warn+skip (nie blokuje insertu).

**⚠️ Brakujące tabele:** Brak. Referencje w kodzie `vanguard-telegram` do `vanguard_workouts` i `vanguard_daily_wins` zostały poprawione, by odpytywały właściwe tabele: `workout_sessions` i `daily_wins`. Tabela `ai_chat_messages` istnieje i jest używana.

---

### `save-daily-aggregate`

**Auth:** Bearer `VANGUARD_CRON_SECRET` — zwraca 401 jeśli niezgodny.

**Obliczenia:**
- `dopamine_load` = deprecated historical field; active pipeline writes `NULL`
- `fragmentation` = deprecated historical field; active pipeline writes `NULL`
- `execution_score` = completed_tasks / 5
- `identity_score` (0-100): -30 za failed wins, -10 bez wins, -15 protein < 140g, -15 sleep < 6.5h, -10 readiness < 60

**State classification (własna, inna niż VanguardCore):**

| Warunek | Stan |
|---------|------|
| exec < 0.4 AND readiness < 60 | CHAOS |
| readiness < 60 OR hrv < 25 | RECOVERY |
| exec === 1.0 AND readiness ≥ 70 | LOCKED_IN |
| exec ≥ 0.8 | MOMENTUM |
| exec < 0.4 AND readiness ≥ 70 | AVOIDANCE |
| domyślnie | STABLE |

**⚠️ Rozbieżność:** VanguardCore (`src/lib/vanguardCore.js`) używa z-score baseline-relative classification. `save-daily-aggregate` używa hardcoded thresholds. Dwa różne klasyfikatory działają równolegle.

---

### `vanguard-analyst`

**Model:** DeepSeek Reasoner (`deepseek-reasoner`) — strips `<think>...</think>` tags z odpowiedzi.

**Próg zapisu:** `hypothesis_confidence >= 0.3` → insert do curiosity_queue.

**Reads `friction_events.later_cost`** — kolumna nie w DDL, ale prawdopodobnie istnieje (ALTER poza migracjami).

**Cron:** `vanguard-daily-analyst` (mig. `20260513000008`) — jedyny aktywny job, `0 3 * * *` UTC. Duplikat `vanguard-daily-shadow-analysis` (mig. `20260513000009`) został usunięty w mig. `20260525170000`. Potwierdź live DB przez `scripts/ops/cron-check.sql` query #2.

---

### `ingest-vault-log`

**Chunking:** 400 słów, overlap 50.

**SHA-256 dedup** przez `vanguard_raw_events.raw_hash` — reingest tego samego tekstu reużywa `raw_event_id`.

**Error handling:** Zwraca 200 nawet przy błędzie catch — celowe, żeby nie pokazywać błędu w Telegramie.

**Ontologia na żywo:** Pobiera relacje z `vanguard_relation_ontology` przy każdym wywołaniu (nie hardcoded jak w vanguard-architect).

---

### `vanguard-eval-runner`

**⚠️ Bug:** Model judge to `gpt-5-mini` (linia ~52) — prawdopodobnie literówka `gpt-4o-mini`.

**Pass threshold:** score >= 0.7.

**Finalizacja:** Pełne podsumowanie liczone tylko na ostatnim batchu (`finished=true`) — czyta WSZYSTKIE wyniki z DB, nie tylko z bieżącego batchu.

---

## 4. Guardrails i decyzje architektoniczne

### 4.1 Oracle write access — wyłączony

**Lokalizacja:** `vanguard-oracle/index.ts` linie 477–481.

**Decyzja:** Oracle w każdym turnie rozmowy mógł pisać do `vanguard_knowledge` i `vanguard_entity_links`. Oznacza to, że LLM mógł mutować source-of-truth (dane behawioralne, graf wiedzy) na podstawie konwersacji — bez żadnej weryfikacji. W Sprint 0.7 (2026-05-17) wyłączone do czasu implementacji explicit temporal guards i human confirmation w Sprint 1.

### 4.2 confidence = null zamiast liczby

**Lokalizacja:** `vanguard-auto-classify/index.ts` linia ~248.

**Decyzja:** Poprzednia wartość `0.65` była hardcoded dla każdego friction_event, niezależnie od jakości odpowiedzi modelu ani ilości wypełnionych pól. System twierdził, że mierzy pewność, a w rzeczywistości zawsze wpisywał tę samą liczbę. `null` jest bardziej szczere — brak sygnału, który wygląda jak pomiar.

### 4.3 vanguard-architect nie ekstraktuje friction

**Lokalizacja:** `vanguard-architect/index.ts` linie 700–703, funkcja `extractFrictionEvent` linie 466–545.

**Decyzja:** Architect i auto-classify jednocześnie tworzyły `friction_events` dla tych samych rekordów. Od Sprint 0.7 jedyna kanoniczna ścieżka: `vanguard_stream → tr_vanguard_auto_classify → vanguard-auto-classify`. Funkcja `extractFrictionEvent` pozostaje w kodzie jako dead code — nie wywołana.

### 4.4 confirmed_friction_events

**Lokalizacja:** `docs/PRODUCT_PRINCIPLES.md`.

**Koncepcja:** Widok/bramka która filtruje `friction_events` do tych z `review_status IN ('good','user_confirmed','user_corrected')` — żeby analityka (analyst, raport) operowała tylko na zweryfikowanych zdarzeniach, nie na surowym output LLM.

**Status:** PENDING. Widok nie istnieje. Kolumna `review_status` nie istnieje w DDL. Niezaimplementowane.

### 4.5 Closure proposals pattern

**Lokalizacja:** `vanguard-auto-classify/index.ts` linie 199–230, migracja `20260519000001`.

**Problem który rozwiązuje:** LLM (DeepSeek) zwracał `is_closure: true` → system automatycznie pisał `valid_until` do historycznych rekordów `vanguard_stream`. Threshold 0.65 to fuzzy match — model mógł permanentnie oznaczyć jako nieważne rekordy które są tematycznie podobne, ale nie są tym samym wątkiem. `vanguard_stream` jest source-of-truth całego systemu.

**Implementacja:** Zamiast `UPDATE vanguard_stream SET valid_until` — `INSERT INTO vanguard_stream_closure_proposals STATUS='pending'`. Faktyczny `valid_until` update: dopiero po `status='approved'` (P3, jeszcze nieimplementowane). Propozycje można przeglądać przez `scripts/closure_proposals_review.sql`.

### 4.6 Timezone — Europe/Warsaw

**Zasada:** UTC stored, Warsaw displayed. Wzorzec do użycia w edge functions:
```typescript
// yyyy-MM-dd format (Swedish locale = ISO format natywnie)
const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Warsaw' })

// display string
const localTime = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })
```

**Gdzie naprawione:** `vanguard-auto-classify` (2026-05-19). Pozostałe edge functions: nieznane — nie audytowane systematycznie.

### 4.7 response.ok przed .json()

**Zasada:** Każdy `fetch()` do zewnętrznego API (DeepSeek, OpenAI, Telegram) musi mieć `if (!res.ok)` przed `await res.json()`. Brak tego powoduje, że 429/500 odpowiedź jest parsowana jako pusty JSON i nadpisuje dane produkcyjne.

**Naprawione (2026-05-19):** vanguard-auto-classify, vanguard-briefing, vanguard-intentions-cleanup, vanguard-backfill, vanguard-telegram (Whisper + 2x embedding).

**Wzorzec dla throw:**
```typescript
if (!res.ok) {
  const errText = await res.text().catch(() => 'unknown')
  throw new Error(`DeepSeek error (${res.status}): ${errText.substring(0, 200)}`)
}
```

**Wzorzec dla warn+skip (non-blocking, np. embedding):**
```typescript
if (embedRes.ok) {
  const embedData = await embedRes.json()
  embedding = embedData.data?.[0]?.embedding
} else {
  console.warn(`OpenAI embedding HTTP error: ${embedRes.status}`)
}
```

---

## 5. Znane problemy techniczne

### P0 — Blocker dla produkcji

| # | Problem | Lokalizacja | Efekt |
|---|---------|-------------|-------|
| 1 | ~~**friction_type CHECK mismatch**~~ | **FIXED** — constraint ma wszystkie typy: training_drop, social_hesitation, communication_drift, self_control_break, positive_micro_action | — |
| 2 | ~~**friction_events brakujące kolumny**~~ | **FIXED** — declared_intention, actual_behavior, deviation, immediate_cost, emotional_state, people_involved, location_context, status, review_status istnieją w DB | — |
| 3 | ~~**find_entity_seeds_by_embedding RPC**~~ | **FIXED** — RPC istnieje w DB (`query_embedding vector, match_user_id uuid, match_count int DEFAULT 6`) | — |

### P1 — Istotne

| # | Problem | Lokalizacja | Efekt |
|---|---------|-------------|-------|
| 4 | ~~Duplicate cron — vanguard-analyst~~ | **FIXED** mig. `20260525170000` | `vanguard-daily-shadow-analysis` usunięty; potwierdź przez `scripts/ops/cron-check.sql` query #2 |
| 5 | ~~vanguard_intentions is_active vs status~~ | **FIXED 2026-05-26** | Oracle używa `.eq('status', 'active')` — poprawna kolumna |
| 6 | **Hardcoded JWT w migracjach** | mig. 005, 006, 009 | Service role key w git history — wymaga rotacji jeśli repo publiczne |
| 7 | ~~**gpt-5-mini w eval-runner**~~ | **FIXED** — używa `gpt-4o-mini` (TECHNICAL.md był nieaktualny) | — |

### P2 — Pending do implementacji

| # | Problem / Feature | Status |
|---|-------------------|--------|
| 8 | ~~`confirmed_friction_events` VIEW~~  | **FIXED 2026-05-27** — VIEW istnieje, poprawiony filter `review_status IN ('good','user_confirmed','user_corrected')` (poprzedni filtrował `status` — zawsze pusty) |
| 9 | ~~Closure proposals approval flow~~ | **FIXED 2026-05-27** — `closureProposal.ts` handler + Telegram ✅/❌ buttons wdrożone; auto-classify wysyła powiadomienie z przyciskami po utworzeniu propozycji |
| 10 | ~~P2 parser w vanguard-daily-reconciliation~~ | **FIXED 2026-05-27 + adoption** — `_shared/reconciliationParser.ts` + konsumpcja: reconciliation handler (bridge + planningDraft z `p2_reflection` + `user_named_blockers`), Oracle (sekcja z refleksją), morning-brief (refleksja + blokery). `blocker_candidates` traktowane wyłącznie jako hipotezy użytkownika. |
| 11 | ~~`vanguard_correlations` tabela~~ | **FIXED 2026-05-31** — DDL w mig. 20260531000001; UNIQUE (user_id, signal_name); RLS enabled |
| 12 | ~~`vanguard_temporal_links` tabela~~ | **FIXED 2026-05-31** — DDL w mig. 20260531000001; UNIQUE (user_id, source_date, target_date); RLS enabled |
| 13 | ~~`vanguard-transurfing-reset` funkcja~~ | **CLOSED** — ghost reference; zero śladów w kodzie, migracjach ani rules; żadna istniejąca funkcja jej nie wywołuje |

### P3 — Dług techniczny

| # | Problem | Lokalizacja |
|---|---------|-------------|
| 14 | ~~Hardcoded user_id fallback `165ae341-...`~~ | **FIXED** — wszystkie funkcje używają `getVanguardUserId()` z `_shared/constants.ts`; fallback UUID żyje tylko tam z komentarzem i jest nadpisywalny przez env `VANGUARD_USER_ID` |
| 15 | ~~Dwa klasyfikatory stanów~~ | **CLOSED** — save-daily-aggregate deleguje do `core.determineState()` (z-score, linia ~110); hardcoded progi istnieją TYLKO w gałęzi `bl.calibrating=true` jako fallback przy <5 dniach historii — celowe zachowanie |
| 16 | ~~`ARCHITECTURE.md` stale schedules~~ | **CLOSED** — stale reference do analysta "co 6h na Monday" nie istnieje w aktualnym ARCHITECTURE.md; cron table jest poprawna |
| 17 | ~~Brakujące tabele (referenced, no DDL)~~ | **FIXED** — vanguard_correlations + vanguard_temporal_links mają DDL w mig. 20260531000001 |

---

## 6. VanguardCore — silnik obliczeniowy

**Plik:** `src/lib/vanguardCore.js` (685 linii)

**Zasada:** Jedyne source-of-truth dla klasyfikacji stanu po stronie klienta. Zastąpił `signalAnalytics.js` i `stateEngine.js`.

**`computeSignals()`** — czysta funkcja, zero side-effects. Wejście: surowe dane z 5 źródeł. Wyjście: znormalizowane sygnały z confidence wektorami.

**Confidence flags:**
- `digital`: 0.0 until a new active digital telemetry source is defined
- `biometrics`: 0.9 jeśli sleep != null, 0.2 jeśli brak
- `is_stale`: true jeśli oura.date ≠ dzisiaj

**Kalibracja:** Mniej niż 5 dni historii → `CALIBRATING` state, safe defaults zamiast z-score.

**Hard limits (niezależne od baseline):**

| Warunek | Stan |
|---------|------|
| sleep < 5.5h | CHAOS |
| readiness < 55 | RECOVERY |
| hrv < 50% baseline mean | RECOVERY |
| sleep < 6.2h | RECOVERY |

**Stability score (0-100):** Execution, training, protein, sleep and HRV. Digital Peace is inactive until a new active telemetry source is defined. Modifier ×0.8 jeśli high RPE + low bio.

**Protein goal:** 160g (hardcoded, linia 78).

---

*Ostatnia aktualizacja: 2026-06-01 | P2 adoption + BACKLOG-01 event_kind taxonomy (prompt sharpening + monitoring mode) + doc refresh*
