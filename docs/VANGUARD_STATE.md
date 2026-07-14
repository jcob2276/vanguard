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
| **TYDZIEŃ** | Calendar | Direction (review/refleksja, KPI, sprint), WeekHub, NutritionCard |
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

## Backend — Edge Functions

Dla zachowania spójności i zapobiegania rozjazdowi informacji, pełny rejestr wszystkich wdrożonych Edge Functions oraz ich konfiguracji jest utrzymywany w jednym miejscu.

Zobacz Single Source of Truth (SSOT) dla backendu:
👉 **[supabase/functions/README.md](../supabase/functions/README.md)**

---

## Baza Danych — Główne Tabele i Schemat

Baza danych Supabase jest podzielona na logiczne obszary domenowe. Pełne i aktualne definicje typów znajdują się w `src/lib/database.types.ts`. Poniżej znajduje się wyszczególnienie kluczowych domen danych:

*   **Strumień i tarcia** (`vanguard_stream`, `friction_events`, `confirmed_friction_events`): Rejestruje surowy strumień wejściowy użytkownika z Telegrama/głosówek oraz automatycznie wykryte tarcia behawioralne (avoidance, habit_break, itp.).
*   **Planowanie i PowerList** (`daily_wins`, `weekly_reviews`, `sprint_goals`, `kpi_entries`, `life_goals`): Pentla celów i zadań – od BHAG (cele życiowe), przez cele sprintu i KPI, po dzienne wykonanie PowerList.
*   **Oracle i RAG** (`vanguard_oracle_runs`, `oracle_clarification_requests`, `vanguard_behavioral_patterns`, `vanguard_wiki_pages`): Logi Wyroczni, pytania doprecyzowujące dla użytkownika (active learning) oraz pamięć skompilowana (wiki) i wyekstrahowane wzorce.
*   **Biometria i sport** (`oura_daily_summary`, `oura_enhanced`, `oura_sleep_*`, `oura_heartrate`, `strava_activities`, `workout_sessions`, `exercise_logs`, `daily_strain`): Dane z Oura Ring, aktywności ze Strava oraz lokalnych logów treningowych i sauny, z których wyliczany jest dobowy Strain/Recovery.
*   **Dieta i zdrowie** (`daily_nutrition`, `daily_food_entries`, `food_library`, `body_metrics`, `medical_lab_results`): Zapisy zjedzonych posiłków, baza produktów, waga oraz wyniki badań laboratoryjnych użytkownika.
*   **Zadania, notatki i projekty** (`projects`, `todo_sections`, `todo_items`, `vanguard_notes`, `vanguard_links`): Zarządzanie zadaniami i projektami oraz synchronizacja notatek Keep i linków.
*   **Tożsamość i inne** (`user_settings`, `vanguard_preferences`, `vanguard_calendar`, `audit_events`, `vanguard_tokens`, `vanguard_identity`, `dreams`, `vision_board_items`): Ustawienia użytkownika, tokeny, zintegrowany kalendarz Google, zdjęcia progresu oraz sny.

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
