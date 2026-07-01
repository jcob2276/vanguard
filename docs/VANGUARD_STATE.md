# Vanguard OS — Stan Aplikacji (01.07.2026)

Dokument opisuje wszystko co istnieje. Podstawa do projektowania nowych funkcji.
SSOT dla stanu backendu: [`supabase/functions/README.md`](../supabase/functions/README.md).

---

## Czym jest Vanguard

Zintegrowany, osobisty kokpit samoobserwacji i logowania Jakuba. System który:
- Zbiera wszystko co Jakub robi, je, ćwiczy, mówi, planuje
- Klasyfikuje tarcia behawioralne (co mówię że zrobię vs co robię)
- Prowadzi pętlę dobową przez Telegram (południe → wieczór)
- Odpowiada na pytania o fakty i biometrię (Oracle)
- Wykrywa wzorce i rozbieżności narracja vs dane
- Zunifikowany kręgosłup planowania (dzień → tydzień → sprint → cel długoterminowy)

**Stack:** React 19 + Vite + TypeScript / Supabase Postgres + Deno Edge Functions / Vercel

---

## Frontend — Zakładki i Widoki

### Nawigacja mobilna (4 zakładki)

| Zakładka | Ikona | Zawartość |
|---|---|---|
| **DZIŚ** | Sun | PowerList, DailyStrainCard, StravaWidget, NutritionTrainingBarCard, FoodQuickCapture, TrainingSaunaQuickBar, SpineGuideStrip, ActionCenterSheet |
| **TYDZIEŃ** | Calendar | Direction (review/refleksja, KPI, sprint), WeekHub, NutritionCard, LifeGoalsPanel |
| **PROJEKTY** | FolderKanban | Projects (lista + KPI + milestone), GoalCreateModal |
| **HISTORIA** | Clock | Stats (ciało, treningi, dieta), Photos, MuscleHeatmap, InsightsDashboard |

### Trasy (App.tsx)

| Trasa | Komponent | Opis |
|---|---|---|
| `/` | `Dashboard` | Główny dashboard mobilny (4 zakładki) |
| `/dashboard` | `DesktopDashboard` | Wielokolumnowy cockpit desktopowy |
| `/settings` | `SettingsView` | Ustawienia |
| `/rozwoj` | `GrowthView` | Rozwój: skill tree, radar, projekty, media queue, week plan |
| `/badania` | `MedicalStudiesPage` | Badania medyczne: lab results, biology scores, trend charts |
| `/korealcje` | `CorrelationsPage` | Korelacje między zmiennymi, BehaviorEffectCard |

### Widoki dodatkowe (modal / pełny ekran)

- **Todo** (`/` →(todo)`) — Sekcje zadań, priorytety, drag & drop, linkowanie do projektów
- **Keep** — Notatki WYSIWYG (bold, italic, kod, tabela, kolory, tagi, archiwum, rich editor z toolbar)
- **WorkoutLogger** — Logowanie treningu (ćwiczenia, serie, wagi, RIR, RPE) + auto-resume po kill PWA
- **SaunaLoggerModal** — Logowanie sesji sauny
- **LinksInbox** — Share target PWA (zapisywanie linków z przeglądarki)
- **FoodEntryModal** — Wyszukiwanie jedzenia (favorites/recent, NL parsing, barcode lookup)
- **ActionCenterSheet** — Panel akcji (system_proposals: Istotne / Olej)

### Desktop Dashboard (`/dashboard`)

Wielokolumnowy cockpit z panelami:
- DesktopHero, Heatmap, SmartAlerts, MarathonPanel
- IntelligencePanel, LeniePanelMini, HexagonPanel
- FitnessScorePanel, HabitsPanel, BehaviorCapturePanel
- DreamsPanel, VisionBoardPanel, SprintPanel
- GeneralView (uniwersalny widok)

---

## Backend — Edge Functions (40 funkcji)

SSOT: [`supabase/functions/README.md`](../supabase/functions/README.md) — ostatni pass: 2026-06-30.

### Daily Loop (pętla dobowa)

| Czas (Warsaw) | Funkcja | Co robi |
|---|---|---|
| 06:00 | `vanguard-nutrition-coach` | Dzienne cele TDEE/białko → `nutrition_targets` + Telegram push |
| 20:30 | `sync-strava` | Pobiera aktywności z poprzedniego dnia (pg_cron `30 20 * * *` UTC) |
| 11:20 | `rescore-workout-sessions` | Przelicza HR stats sesji treningowych (pg_cron `20 11 * * *` UTC) |
| 11:25 | `compute-illness-signal` | Wykrywanie sygnałów choroby (pg_cron `25 11 * * *` UTC) |
| 12:00 (pn-pt) | `vanguard-eval-interview` | Refleksyjny wywiad przez Telegram (pg_cron `0 10 * * 1-5` UTC) |
| 03:00 | `vanguard-analyst` | 72h analiza wzorców, hipotezy (pg_cron `0 3 * * *` UTC) |
| 03:20 | `vanguard-wiki-compiler` | Kompilacja pamięci wiki (pg_cron `20 3 * * *` UTC) |
| 04:00 | `save-daily-aggregate` | Dzienny snapshot do `vanguard_daily_aggregates` (pg_cron `0 4 * * *` UTC) |
| ~21:30 | `vanguard-daily-reconciliation` | Wieczorna refleksja (prompt Telegram) |
| niedziela ~17:00 | `vanguard-weekly-synthesis` | Tygodniowe podsumowanie wzorców |

### Integracje sync

| Funkcja | Trigger | API | Tabele docelowe |
|---|---|---|---|
| `sync-oura` | Frontend / manual | Oura Ring v2 | `oura_daily_summary` |
| `sync-oura-enhanced` | Frontend / manual | Oura Ring v2 | `oura_enhanced` |
| `sync-oura-timeseries` | Frontend / manual | Oura Ring v2 | `oura_heartrate`, `oura_sleep_*`, `oura_activity_met_timeline`, `oura_workouts`, `oura_sessions` |
| `sync-strava` | pg_cron / manual | Strava OAuth2 | `strava_activities`, `strava_tokens` |
| `sync-calendar` | Frontend / manual | Google Calendar OAuth2 | `vanguard_calendar` |

### Analiza i przetwarzanie

| Funkcja | Trigger | Co robi |
|---|---|---|
| `compute-daily-strain` | Frontend / manual | Wylicza `daily_strain` z Oura + Strava + RPE |
| `compute-correlations` | Frontend / manual | Korelacje między zmiennymi (read-only) |
| `compute-behavior-effects` | Frontend / manual | "What Moves You" — Welch t-test + Cohen's d (read-only) |
| `compute-recovery-forecast` | Frontend / manual | Wieczorna prognoza recovery na jutro (read-only) |
| `compute-weekly-digest` | Frontend / manual | Deterministyczny przegląd tydzień-do-tygodnia (read-only) |
| `rescore-workout-sessions` | pg_cron | Przelicza HR stats sesji treningowych |
| `compute-illness-signal` | pg_cron | Wykrywanie sygnałów choroby z Oura + behavior |
| `analyze-food-quality` | Frontend / manual | Jakość jedzenia (DeepSeek) |
| `analyze-training-load` | Frontend / manual | Analiza obciążenia treningowego (LLM) |

### AI Core

| Funkcja | Trigger | JWT | Co robi |
|---|---|---|---|
| `vanguard-oracle` | Telegram `?`/`!!`/`@` / frontend | false | RAG chat z pełnym kontekstem. 3 tryby: chat/planning/mirror |
| `vanguard-auto-classify` | DB trigger na `vanguard_stream` | false | DeepSeek → importance, category, tags + friction detection → `friction_events` |
| `vanguard-architect` | Batch (HTTP) | false | Ekstrakcja encji → `vanguard_entity_links` (graf wiedzy) |
| `vanguard-wiki-compiler` | Cron / HTTP | false | Kompiluje roszczenia → `vanguard_wiki_pages` + queue review |
| `vanguard-telegram` | Webhook Telegram | false | Router wiadomości (text/voice/callback) |
| `vanguard-detect-patterns` | Frontend (on-demand) | true | Wykrywanie wzorców z friction_events + stream |
| `vanguard-week-recap` | Frontend (Direction) | true | Tygodniowe podsumowanie (daily_wins, friction, stream) |

### Frontend-only AI

| Funkcja | Trigger | JWT | Co robi |
|---|---|---|---|
| `vanguard-goal-create` | Frontend (AI tworzenie celu) | true | 5 pytań → DeepSeek → JSON (project_name, affirmation, kpis, checkpoints) |
| `vanguard-todo-classify` | Frontend (background) | true | Klasyfikacja zadań |
| `parse-food-nl` | Frontend (NL meal) | true | Natural language → jedzenie |
| `parse-workout-nl` | Frontend (WorkoutQuickCapture) | true | Natural language → trening |
| `lookup-food` | Frontend (FoodEntryModal) | true | Wyszukiwanie jedzenia / barcode |
| `vanguard-keep-triage` | Frontend (Direction) | true | Triage notatek Keep |
| `vanguard-kpi-suggest` | Frontend (Direction) | true | Sugestie KPI dla projektów |

### Inne

| Funkcja | Trigger | JWT | Co robi |
|---|---|---|---|
| `vanguard-librarian` | Manual / cron | false | Rozwiązuje `llm_estimate` → `food_library`, powiadomienie Telegram |
| `vanguard-eval-runner` | HTTP batch | false | Ewaluacja vs oracle (gpt-4o-mini sędzia) |
| `vanguard-graph-embedder` | HTTP batch | false | Embeddingi encji grafu |
| `ingest-vault-log` | HTTP (z telegram) | false | Long-form voice/vault → stream chunks + graph |
| `vanguard-push-reminder` | pg_cron (every minute) | false | Push notifications z todo_items |

### Telegram Handler Map

| Area | Path | Role |
|------|------|------|
| Webhook entry | `index.ts` | Parse payload, auth `chat_id`, dispatch |
| Callback router | `_router/callbacks.ts` | Button clicks → handlers |
| Message pipeline | `_router/messages.ts` | Stream, voice, Oracle, reconciliation routing |
| Config | `_router/config.ts` | `createTelegramContext()` |
| Reconciliation | `_handlers/reconciliation.ts` | Evening reflection reply |
| Feedback buttons | `_handlers/feedback.ts` | `fb_ok` / `fb_err` |
| Anti-analysis guard | `_handlers/antiAnalysis.ts` | Analysis drift buttons |
| Closure proposals | `_handlers/closureProposal.ts` | Stream closure ✅/❌ buttons |

---

## Baza Danych — Tabele

### Stream i Tarcia

| Tabela | Opis |
|---|---|
| `vanguard_stream` | Jedyna write-path dla surowych wpisów. source: telegram/voice/vault/system |
| `friction_events` | Wykryte tarcia: avoidance, procrastination, emotional_spike, habit_break, social_withdrawal, sleep_disruption, training_drop, positive_micro_action |
| `confirmed_friction_events` | VIEW — tylko review_status IN ('good', 'user_confirmed', 'user_corrected') |
| `vanguard_stream_closure_proposals` | Propozycje zamknięcia wątków (human gate, status: pending/approved/rejected) |

### Pętla Dobowa i Planowanie

| Tabela | Opis |
|---|---|
| `daily_reconciliations` | Wieczorne podsumowania, p2_parsed, voice_content |
| `daily_planning_session` | Sesje planowania |
| `planning_summary` | Skompilowane plany |
| `daily_wins` | PowerList: task_1..5, done_1..5, completed_at, daily_rpe, plan_quality |
| `weekly_reviews` | Refleksje tygodniowe (intention, commitment, cialo/duch/konto) |
| `monthly_reviews` | Zamknięcia miesięczne (pattern, leverage, correction, theme) |
| `sprint_goals` | Cele sprintowe (goal_text, focus_project_ids) |
| `sprint_reviews` | Zamknięcia sprintowe |
| `kpi_entries` | KPI per projekt per tydzień (atomic increment via RPC) |
| `life_goals` | Cele życiowe / BHAG |

### Oracle i AI

| Tabela | Opis |
|---|---|
| `vanguard_oracle_runs` | Historia wywołań Oracle |
| `ai_chat_messages` | Wiadomości chatu AI |
| `oracle_clarification_requests` | Pytania clarifikacyjne Oracle |
| `oracle_pending_actions` | Oczekujące akcje Oracle |
| `system_proposals` | Propozycje systemowe (N>=3 friction / 7 dni) |
| `vanguard_eval_questions` | 60 pytań eval (5 kategorii) |
| `vanguard_eval_runs` | Przebiegi eval |
| `vanguard_eval_results` | Wyniki eval per pytanie |

### Graf Wiedzy

| Tabela | Opis |
|---|---|
| `vanguard_entity_links` | Krawędzie grafu (source_entity → relation → target_entity), temporal |
| `vanguard_entity_aliases` | Aliasy encji (normalizacja) |
| `vanguard_relation_ontology` | FK na dozwolone relacje (~70 typów) |
| `vanguard_knowledge` | Zweryfikowane fakty |
| `vanguard_raw_events` | Surowe eventy z dedup (SHA-256) |
| `knowledge_insight_cards` | Karty insightów |

### Pamięć i Wzorce

| Tabela | Opis |
|---|---|
| `vanguard_behavioral_patterns` | Wzorce zachowań (frequency, confidence, date_range) |
| `vanguard_iron_rules` | Zasady zadeklarowane przez użytkownika |
| `vanguard_wiki_pages` | Skompilowane strony pamięci |
| `vanguard_wiki_sources`, `vanguard_wiki_review_items`, `vanguard_wiki_runs` | Pipeline wiki |
| `vanguard_curiosity_queue` | Kolejka pytań do zbadania |
| `vanguard_feedback` | Feedback użytkownika |

### Biometria (Oura)

| Tabela | Opis |
|---|---|
| `oura_daily_summary` | readiness_score, hrv_avg, rhr_avg, total_sleep_hours, temp_deviation, steps |
| `oura_enhanced` | Rozszerzone dane dzienne |
| `oura_heartrate` | Timeseries HR |
| `oura_hr_zones_daily` | Strefy HR dzienne |
| `oura_sleep_*` | Timeline snu (hr, hrv, phase) |
| `oura_activity_met_timeline` | Aktywność MET w czasie |
| `oura_workouts` | Treningi wykryte przez Oura |
| `oura_sessions` | Sesje medytacyjne / skupienia |

### Treningi

| Tabela | Opis |
|---|---|
| `strava_activities` | Aktywności ze Strava |
| `strava_activities_clean` | View — oczyszczone aktywności Strava |
| `strava_tokens` | OAuth token store |
| `workout_sessions` | Sesje z WorkoutLogger (hr_avg_bpm, hr_peak_bpm, hr_strain_score) |
| `exercise_logs` | Serie: weight, reps, RIR, RPE, notes |
| `workout_muscle_tags` | Tagi partii mięśniowych per sesja |
| `daily_strain` | Wyliczone obciążenie (Strain/21, Recovery/100, main_limiter, daily_status, illness_score) |
| `strain_correlations` | Korelacje strain |
| `training_plan_workouts` | Plan treningowy |

### Dieta

| Tabela | Opis |
|---|---|
| `daily_nutrition` | calories, protein, carbs, fat, fiber, insulin_load, food_quality |
| `daily_food_entries` | Poszczególne wpisy żywieniowe (with parse_meta, food_reference) |
| `food_library` | Baza jedzenia (resolved from llm_estimate) |
| `food_favorites` | Ulubione produkty |
| `food_corrections` | Korekty LLM → ground truth |
| `nutrition_profile` | height_cm, birth_date, sex, goal_body_fat, goal_target_date |
| `nutrition_targets` | Dzienne cele: target_kcal, protein_floor_g, est_maintenance_kcal, verdict |
| `user_portions` | Porcje użytkownika |

### Zdrowie

| Tabela | Opis |
|---|---|
| `body_metrics` | Waga, obwód talii |
| `body_composition_measurements` | % tkanki tłuszczowej, masa mięśni |
| `fasting_logs` | Posty |
| `medical_documents` | Dokumenty medyczne |
| `medical_lab_results` | Wyniki badań |

### Nawyki i Zachowania

| Tabela | Opis |
|---|---|
| `habits` | Definicje nawyków |
| `habit_logs` | Logi nawyków (with context) |
| `behavior_log` | Sygnały dnia (confounders: alkohol, stres, choroba, podróż) |
| `daily_habits` | **Deprecated** — stare checkboxy, używaj `habits` + `habit_logs` |
| `supplements` | Definicje suplementów |
| `supplement_logs` | Logi suplementów |

### Projekty i Zadania

| Tabela | Opis |
|---|---|
| `projects` | title, status (active/paused/archived/completed), priority, start_date, target_completion_date |
| `todo_sections` | Sekcje zadań (project_id optional bridge) |
| `todo_items` | Zadania (title, status, priority, project_id, due_date, **is_milestone**) |

Note: `project_checkpoints` zostało usunięte — milestone'y to teraz `todo_items` z `is_milestone=true`.

### Notatki i Tożsamość

| Tabela | Opis |
|---|---|
| `vanguard_notes` | Notatki Keep |
| `vanguard_links` | Linki z LinksInbox |
| `user_fundament` | Biografia tożsamości (MBTI, filozofia, miasto) |
| `identity_photos` | Zdjęcia progresji |
| `dreams` | Sny |

### Inne

| Tabela | Opis |
|---|---|
| `user_settings` | Tokeny (oura_token), preferencje |
| `vanguard_preferences` | plan_quality_score, morning ritual dates |
| `vanguard_calendar` | Google Calendar events |
| `audit_events` | Log błędów i zdarzeń |
| `vanguard_tokens` | Tokeny systemowe |
| `vanguard_identity` | Tożsamość użytkownika |

---

## Integracje Zewnętrzne

| System | Auth | Co zbiera |
|---|---|---|
| **Oura Ring** | Bearer token (user_settings.oura_token) | Readiness, HRV, RHR, sen, temperatura, kroki, aktywność, treningi |
| **Strava** | OAuth2 (refresh rotation w strava_tokens) | Aktywności sportowe, dystans, HR, suffer_score |
| **Google Calendar** | OAuth2 (redirect) | Synchronizacja kalendarza |
| **Telegram Bot** | Bot token | Input głosowy/tekstowy, output (briefingi, pytania, odpowiedzi, przyciski) |
| **DeepSeek** | API key (env) | LLM: klasyfikacja, Oracle, analiza treningu, nutrition coach, goal create |
| **OpenAI** | API key (env) | Embeddings (text-embedding-3-small), transkrypcja (Whisper) |

---

## Logika Biznesowa

### Vanguard States (7 stanów)

System wylicza aktualny stan Jakuba na podstawie sygnałów:

| Stan | Warunki |
|---|---|
| **LOCKED_IN** | exec === 1.0 AND readiness ≥ 70 |
| **MOMENTUM** | exec ≥ 0.8 |
| **RECOVERY** | readiness < 60 OR hrv < 50% baseline OR sleep < 6.2h |
| **CHAOS** | sleep < 5.5h OR (exec < 0.4 AND readiness < 60) |
| **AVOIDANCE** | exec < 0.4 AND readiness ≥ 70 |
| **CALIBRATING** | <5 dni danych historycznych |

### Sygnały (computeSignals)

- Godziny snu (Oura)
- HRV, RHR (Oura)
- Readiness score (Oura)
- Execution ratio (PowerList: 0–5 zadań, penalty za późne ukończenie)
- Daily RPE
- Ratio białka (spożyte vs cel 160g)
- Konsekwencja treningowa (dni od ostatniego treningu)

### Zunifikowany Kręgosłup Planowania (goalSpine)

SSOT: `src/lib/goalSpine.ts` — jeden fetch łączy dzień → tydzień → sprint → cel długoterminowy.

```
BHAG (life_goals)
  └─ Sprint goal (sprint_goals)
       └─ Month review (monthly_reviews)
            └─ Week plan (weekly_reviews)
                 └─ Day execution (daily_wins → kpi_entries via RPC)
```

- `daily_wins.task_N_target_value` + `task_N_project_id` → auto-rollup do `kpi_entries` przez RPC `increment_kpi_entry_for_week` (tylko gdy projekt ma dokładnie 1 KPI)
- SpineGuideStrip — "prowadzenie za rękę" (jeden komunikat: sprint → tydzień → refleksja → daily)
- Direction — review/refleksja, KPI, sprint, monthly — zunifikowany widok

### Przepływ Stream → Tarcia → Oracle

```
Telegram/Voice
     ↓
vanguard_stream (write)
     ↓ (DB trigger)
vanguard-auto-classify
     ├── DeepSeek → importance, category, tags → update stream
     └── Friction detection → friction_events
                                     ↓ (batch)
                              vanguard-architect
                                     ↓
                              vanguard_entity_links (graf)
                                     ↓ (cron)
                              vanguard-wiki-compiler
                                     ↓
                              vanguard_wiki_pages + review queue
```

### Oracle RAG — Pobieranie Kontekstu

Przy każdym zapytaniu Oracle zbiera:
1. Stream 72h (current-first) + 14-dniowe archiwum
2. `confirmed_friction_events` (VIEW)
3. Biometria (Oura, daily_strain — 7 dni)
4. Wiki pages (skompilowana pamięć)
5. Kontekst medyczny (wyniki badań, pomiary ciała)
6. Wzorce (behavioral_patterns, iron_rules)

Następnie: DeepSeek chat (tryb: `chat` / `planning` / `mirror`)

### Daily Strain — Jak się liczy

Wejście: Oura (cardio zones, sleep, readiness) + Strava (suffer_score) + RPE z PowerList
Wyjście: `daily_strain`
- `strain_score` (0–21, wzorowany na Whoop)
- `recovery_score` (0–100)
- `main_limiter` (sleep/kalorie/cardio_load/siłownia/mental_load)
- `daily_status` (green/yellow/red)
- `illness_score`, `illness_level` (z compute-illness-signal)

### System Proposals (N>=3 friction)

`vanguard-analyst` wykrywa powtarzające się tarcia (≥3 potwierdzone w 7 dni) → `system_proposals` (via RPC `sync_friction_proposals`) → Week Hub / Action Center pokazuje je użytkownikowi do oceny (Istotne / Olej).

---

## Deprecated — Nie Używać

### Funkcje (usunięte z codebase / stub 410)
- `vanguard-morning-brief` — usunięta
- `vanguard-morning-ping` — usunięta
- `vanguard-midday-check` — usunięta
- `vanguard-briefing` — usunięta
- `vanguard-friction-qa` — usunięta
- `analyze-training` — usunięta (stub 410)
- `sync-yazio` — usunięta (dieta przez app food log)
- `vanguard-weekly-brief` — stubbed 410 (skonsolidowane do Direction)
- `vanguard-backfill` — usunięta
- `vanguard-debug-retrieval` — usunięta

### Tabele (usunięte / nie pisać)
- `career_projects`, `career_moves`, `career_evidence`, `career_decisions` — usunięte 2026-06-30
- `project_checkpoints` — usunięte 2026-06-30 (milestone'y to `todo_items.is_milestone`)
- `goals` — usunięte 2026-06-30
- `focus_sessions` — usunięte 2026-06-30
- `vision_board_items` — zero odwołań
- `vanguard_pattern_feedback` — zero odwołań
- `vanguard_intentions` — usunięte 2026-06-11
- `vanguard_correlations`, `vanguard_temporal_links` — usunięte 2026-06-11
- `stayfree_usage` — deprecated, brak ingestion path
- `daily_habits` — deprecated, używaj `habits` + `habit_logs`

### Komponenty (usunięte)
- OuraWidget, OuraEnhanced, SleepDebtCard, MentorChat, GraphMind, ThoughtStream
- IntentionTracker, ManifestationBoard, LocationTracker, AWImporter
- WeeklyReview.tsx (skonsolidowane do Direction)

---

## Reguły Krytyczne (z AGENTS.md)

1. **Strefa czasowa:** Zawsze `Europe/Warsaw` — nigdy UTC dla dat
2. **Supabase:** `createServiceClient()` + `safeExecute()` + `resolveUserScope()`
3. **Graf:** Oracle tylko czyta. Mutacja grafu tylko przez pipeline Architect/Ingest
4. **verify_jwt: false** dla cronów i webhooków Telegram
5. **planning_status:** Tylko `pending` / `active` / `completed` (nie 'done')
6. **Prompt injection:** Telegram/stream to untrusted input
7. **Po każdym deploy:** `npm run smoke`

---

*Ostatnia aktualizacja: 01.07.2026*
