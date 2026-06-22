# Vanguard OS — Stan Aplikacji (19.06.2026)

Dokument opisuje wszystko co istnieje. Podstawa do projektowania nowych funkcji.

---

## Czym jest Vanguard

Zintegrowany, osobisty kokpit samoobserwacji i logowania Jakuba. System który:
- Zbiera wszystko co Jakub robi, je, ćwiczy, mówi, planuje
- Klasyfikuje tarcia behawioralne (co mówię że zrobię vs co robię)
- Prowadzi pętlę dobową przez Telegram (ranek → południe → wieczór)
- Odpowiada na pytania o fakty i biometrię (Oracle)
- Wykrywa wzorce i rozbieżności narracja vs dane

**Stack:** React 19 + Vite + TypeScript / Supabase Postgres + Deno Edge Functions / Vercel

---

## Frontend — Zakładki i Widoki

### Nawigacja (4 zakładki)

| Zakładka | Ikona | Zawartość |
|---|---|---|
| **DZIŚ** | Sun | PowerList, DailyStrainCard, BlockTimer, StravaWidget, GoalsCard |
| **TYDZIEŃ** | Calendar | NutritionCard (budżet kalorii, białko), Direction (projekty tygodniowe) |
| **PROJEKTY** | FolderKanban | Projects (lista + checkpointy), nudge Weekly Review |
| **HISTORIA** | Clock | Stats (ciało, treningi, dieta), Photos, MuscleHeatmap |

### Widoki dodatkowe (modal / pełny ekran)

- **Todo** — Sekcje zadań, priorytety, linkowanie do projektów
- **Keep** — Notatki WYSIWYG (bold, italic, kod, tabela, kolory, tagi, archiwum)
- **WorkoutLogger** — Logowanie treningu (ćwiczenia, serie, wagi, RIR, RPE)
- **MorningRitual** — Rytuał poranny (streak, intencja)
- **LinksInbox** — Share target PWA (zapisywanie linków z przeglądarki)
- **WeeklyReview** — Refleksja tygodniowa (formularze, zapis do weekly_reviews)
- **Desktop** — Szerszy widok wielokolumnowy z CockpitBanner, SmartAlerts, WeeklyDigest

---

## Komponenty — Co Robi Każdy

### Zakładka DZIŚ

**PowerList** — 5 priorytetów dnia (Ciało/Duch/Konto)
- Użytkownik wpisuje zadania lub linkuje z Todo
- Śledzi czas ukończenia (penalty po 21:00)
- RPE dzienny (1–10)
- Zapis → `daily_wins` (task_1..5, done_1..5, completed_at_1..5, daily_rpe)
- Streak badge (ile dni z rzędu task_1 wypełniony)

**DailyStrainCard** — Obciążenie i regeneracja ciała
- Dane: `daily_strain` + `oura_daily_summary`
- Pokazuje: Strain score (/21), Recovery score (/100)
- Metryki Oura: HRV, RHR, Sen, Temp. odchylenie, Kroki
- Przycisk refresh → syncAll (Yazio → Oura enhanced → Oura timeseries → Strava → compute strain)
- Kolor karty zależy od `daily_status` (green/yellow/red)

**StravaWidget** — Ostatnie aktywności ze Strava
- Dane: `strava_activities`
- Pokazuje: nazwa, dystans, czas, HR, suffer_score

**GoalsCard** — Aktywne projekty / cele

**BlockTimer** — Bloki czasowe dnia

### Zakładka TYDZIEŃ

**NutritionCard** — Budżet kaloryczny i białko
- Dane: `daily_nutrition` (7 dni), `nutrition_targets`
- Pokazuje: kalorie tygodniowe, białko dzienne, procent realizacji celu
- Cel: ~14% BF na maraton 4.10.2026

**Direction** — Projekty tygodniowe

### Zakładka HISTORIA

**Stats** — Analityka historyczna
- Masa ciała i obwód talii (trend)
- Sesje treningowe z dziennika
- Rozkład białka i jakość jedzenia
- Eksport: Markdown (stats + Yazio + journal + treningi + ciało + nawyki), Oura CSV

**MuscleHeatmap** — Częstotliwość treningu per partia mięśniowa
- Dane: `workout_muscle_tags`
- Heatmapa: klatka, plecy, nogi, ramiona itd.

**Photos** — Galeria zdjęć kompozycji ciała
- Dane: Supabase Storage + `identity_photos`
- Posortowane po dacie

### Zakładka PROJEKTY

**Projects** — Zarządzanie projektami
- CRUD projektów
- Kamienie milowe (checkpoints) z datami
- Statusy: active/paused/archived/completed
- Priorytet, opis, daty start/cel
- **AI tworzenie celu** — 5 pytań → DeepSeek → `vanguard-goal-create` → preview (project_name, affirmation, kpis, checkpoints) → zapis
- KPI per projekt (goal_kpis) z wartościami current/target + snapshoty (goal_kpi_snapshots)

### Oracle / AI

**AIInsight** — Chat mirror z Oracle
- Wywołuje `/vanguard-oracle` z `mode: mirror`
- Cache 1h w localStorage
- Diagnoza aktualnego stanu

---

## Backend — Edge Functions (38 funkcji)

### Daily Loop (pętla dobowa)

| Czas (Warsaw) | Funkcja | Co robi |
|---|---|---|
| 06:00 | `vanguard-nutrition-coach` | Dzienne cele TDEE/białko → `nutrition_targets` |
| 10:00 | `sync-strava` (20:30 UTC) | Pobiera aktywności z poprzedniego dnia |
| 12:00 (pn-pt) | `vanguard-eval-interview` | Refleksyjny wywiad przez Telegram |
| 05:00 | `vanguard-analyst` | 72h analiza wzorców, hipotezy |
| 05:20 | `vanguard-wiki-compiler` | Kompilacja pamięci wiki |
| 06:00 | `save-daily-aggregate` | Dzienny snapshot do `vanguard_daily_aggregates` |
| ~21:30 | `vanguard-daily-reconciliation` | Wieczorna refleksja (prompt Telegram) |

### Integracje sync (manualne lub cron)

| Funkcja | API | Tabele docelowe |
|---|---|---|
| `sync-oura` | Oura Ring v2 | `oura_daily_summary` |
| `sync-oura-enhanced` | Oura Ring v2 | `oura_enhanced` |
| `sync-oura-timeseries` | Oura Ring v2 | `oura_heartrate`, `oura_sleep_*`, `oura_activity_met_timeline`, `oura_workouts`, `oura_sessions` |
| `sync-strava` | Strava OAuth2 | `strava_activities`, `strava_tokens` |
| `sync-yazio` | Yazio SDK | `daily_nutrition`, `daily_food_entries` |
| `sync-calendar` | Google Calendar OAuth2 | `vanguard_calendar` |
| `sync-todoist` | Todoist API | todo tracking |

### Analiza i przetwarzanie

| Funkcja | Trigger | Co robi |
|---|---|---|
| `compute-daily-strain` | Manual/post-sync | Wylicza `daily_strain` z Oura + Strava + RPE |
| `compute-correlations` | Manual | Korelacje między zmiennymi |
| `analyze-food-quality` | Manual | Jakość jedzenia (DeepSeek) |
| `analyze-training-load` | Manual | Analiza obciążenia treningowego |

### AI Core

| Funkcja | Trigger | Co robi |
|---|---|---|
| `vanguard-oracle` | Telegram `?` / `/wyrocznia` / frontend | RAG chat z pełnym kontekstem. 3 tryby: chat/planning/mirror |
| `vanguard-auto-classify` | DB trigger na `vanguard_stream` | DeepSeek → importance (1-10), category, tags + wykrywanie friction → `friction_events` |
| `vanguard-architect` | Batch | Ekstrakcja encji → `vanguard_entity_links` (graf wiedzy) |
| `vanguard-wiki-compiler` | Cron 05:20 | Kompiluje roszczenia → `vanguard_wiki_pages` + queue review |
| `vanguard-telegram` | Webhook Telegram | Router wiadomości (text/voice/callback) → 11 handlerów |
| `vanguard-goal-create` | Frontend (AI tworzenie celu) | 5 odpowiedzi → DeepSeek → JSON (project_name, affirmation, kpis, checkpoints) |
| `vanguard-weekly-synthesis` | Cron niedziela | Tygodniowe podsumowanie wzorców |

### Telegram Handlery (11 szt.)

- `morning.ts` — Start 90min, minimum setup
- `midday.ts` — Południe callbacks
- `reconciliation.ts` — Wieczorna refleksja
- `planning.ts` — Tryb planowania z Oracle
- `patternFeedback.ts` — Feedback na wzorce
- `feedback.ts` — fb_ok / fb_err przyciski
- `saturdayCheckin.ts` — Sobotni check-in
- `antiAnalysis.ts` — Guard przed dryfem analizy
- `morningRescue.ts` — Protokół ratunkowy
- `closureProposal.ts` — Bramy zamknięcia
- `savedLinks.ts` — Share target / PWA

---

## Baza Danych — Tabele

### Stream i Tarcia

| Tabela | Opis |
|---|---|
| `vanguard_stream` | Jedyna write-path dla surowych wpisów. source: telegram/voice/vault/system |
| `friction_events` | Wykryte tarcia: avoidance, procrastination, emotional_spike, habit_break, social_withdrawal, sleep_disruption |
| `confirmed_friction_events` | VIEW — tylko review_status IN ('good', 'user_confirmed', 'user_corrected') |

### Pętla Dobowa

| Tabela | Opis |
|---|---|
| `daily_reconciliations` | Wieczorne podsumowania, p2_parsed, voice_content |
| `daily_planning_session` | Sesje planowania |
| `planning_summary` | Skompilowane plany |
| `daily_wins` | PowerList: task_1..5, done_1..5, completed_at, daily_rpe, plan_quality |

### Oracle i Graf Wiedzy

| Tabela | Opis |
|---|---|
| `vanguard_oracle_runs` | Historia wywołań Oracle |
| `vanguard_entity_links` | Krawędzie grafu (source_entity → relation → target_entity), temporal |
| `vanguard_entity_aliases` | Aliasy encji (normalizacja) |
| `vanguard_singleton_relations` | Relacje pojedyncze |
| `vanguard_temporal_links` | Temporalne linki grafu |
| `vanguard_relation_ontology` | FK na dozwolone relacje (60+ typów) |
| `vanguard_correlations` | Wyliczone korelacje między zmiennymi |

### Pamięć i Wzorce

| Tabela | Opis |
|---|---|
| `vanguard_behavioral_patterns` | Wzorce zachowań (frequency, confidence, date_range) |
| `vanguard_repeated_patterns` | Często powtarzające się wzorce |
| `vanguard_iron_rules` | Zasady zadeklarowane przez użytkownika |
| `vanguard_known_persons` | Kontekst sieci społecznej |
| `vanguard_wiki_pages` | Skompilowane strony pamięci |
| `vanguard_wiki_sources`, `vanguard_wiki_review_items`, `vanguard_wiki_runs` | Pipeline wiki |

### Ewaluacja

| Tabela | Opis |
|---|---|
| `vanguard_eval_questions` | 60 pytań eval (5 kategorii) |
| `vanguard_eval_runs` | Przebiegi eval |
| `vanguard_eval_results` | Wyniki eval per pytanie |

### Biometria (Oura)

| Tabela | Opis |
|---|---|
| `oura_daily_summary` | readiness_score, hrv_avg, rhr_avg, total_sleep_hours, temp_deviation, steps |
| `oura_enhanced` | Rozszerzone dane dzienne |
| `oura_heartrate` | Timeseries HR |
| `oura_activity_met_timeline` | Aktywność MET w czasie |
| `oura_workouts` | Treningi wykryte przez Oura |
| `oura_sessions` | Sesje medytacyjne / skupienia |

### Treningi (Strava + logger)

| Tabela | Opis |
|---|---|
| `strava_activities` | Aktywności ze Strava (sport_type, distance, avg_HR, suffer_score) |
| `strava_tokens` | OAuth token store |
| `workout_sessions` | Sesje z WorkoutLogger |
| `exercise_logs` | Serie: weight, reps, RIR, RPE, notes |
| `workout_muscle_tags` | Tagi partii mięśniowych per sesja |
| `daily_strain` | Wyliczone obciążenie (Strain/21, Recovery/100, main_limiter, daily_status) |
| `training_plan_workouts` | Plan treningowy |

### Dieta (Yazio)

| Tabela | Opis |
|---|---|
| `daily_nutrition` | calories, protein, carbs, fat, fiber, insulin_load, food_quality |
| `daily_food_entries` | Poszczególne wpisy żywieniowe |
| `nutrition_profile` | height_cm, birth_date, sex, goal_body_fat, goal_target_date |
| `nutrition_targets` | Dzienne cele: target_kcal, protein_floor_g, est_maintenance_kcal, verdict |

### Zdrowie

| Tabela | Opis |
|---|---|
| `body_metrics` | Waga, obwód talii |
| `body_composition_measurements` | % tkanki tłuszczowej, masa mięśni |
| `fasting_logs` | Posty |
| `medical_documents` | Dokumenty medyczne |
| `medical_lab_results` | Wyniki badań |

### Projekty i Zadania

| Tabela | Opis |
|---|---|
| `projects` | title, status (active/paused/archived/completed), priority, start_date, target_completion_date |
| `project_checkpoints` | Kamienie milowe projektu (title, due_date, status, sort_order) |
| `goal_kpis` | KPI per projekt (name, unit, target, current_value, sort_order) |
| `goal_kpi_snapshots` | Historia wartości KPI (kpi_id, value, recorded_at) |
| `todo_sections` | Sekcje zadań |
| `todo_items` | Zadania (title, status, priority, project_id, due_date) |
| `weekly_reviews` | Refleksje tygodniowe |

### Notatki i Tożsamość

| Tabela | Opis |
|---|---|
| `vanguard_notes` | Notatki Keep |
| `vanguard_links` | Linki z LinksInbox |
| `user_fundament` | Biografia tożsamości (MBTI, filozofia, miasto) |
| `identity_photos` | Zdjęcia progresji |
| `dreams` | Sny |
| `vision_board_items` | Vision board |

### Inne

| Tabela | Opis |
|---|---|
| `user_settings` | Tokeny (oura_token, yazio user/pass), preferencje |
| `vanguard_preferences` | plan_quality_score, morning ritual dates |
| `vanguard_calendar` | Google Calendar events |
| `vanguard_curiosity_queue` | Kolejka pytań do zbadania |
| `audit_events` | Log błędów i zdarzeń |
| `vanguard_feedback` | Feedback użytkownika |

---

## Integracje Zewnętrzne

| System | Auth | Co zbiera |
|---|---|---|
| **Oura Ring** | Bearer token (user_settings.oura_token) | Readiness, HRV, RHR, sen, temperatura, kroki, aktywność, treningi |
| **Strava** | OAuth2 (refresh rotation w strava_tokens) | Aktywności sportowe, dystans, HR, suffer_score |
| **Yazio** | Username/password (user_settings) | Kalorie, makros, wpisy żywieniowe |
| **Google Calendar** | OAuth2 (redirect) | Synchronizacja kalendarza |
| **Todoist** | API token | Zadania |
| **Telegram Bot** | Bot token | Input głosowy/tekstowy, output (briefingi, pytania, odpowiedzi, przyciski) |
| **DeepSeek** | API key (env) | LLM: klasyfikacja, Oracle, analiza treningu, nutrition coach, goal create |
| **OpenAI** | API key (env) | Embeddings (text-embedding-3-small), transkrypcja (Whisper) |

---

## Logika Biznesowa

### Vanguard States (5 stanów)

System wylicza aktualny stan Jakuba na podstawie sygnałów:

| Stan | Warunki |
|---|---|
| **LOCKED_IN** | Optymalna egzekucja + dobra biometria |
| **MOMENTUM** | Stała egzekucja, stabilna biometria |
| **RECOVERY** | Niska biometria, świadome odciążenie |
| **CHAOS** | Kolaps bio + behawioralny |
| **AVOIDANCE** | Zasoby są, egzekucja znika |
| **CONSUMING** | Dominacja digital nad outputem |
| **CALIBRATING** | <5 dni danych historycznych |

### Sygnały (computeSignals)

- Godziny snu (Oura)
- HRV, RHR (Oura)
- Readiness score (Oura)
- Execution ratio (PowerList: 0–5 zadań, penalty za późne ukończenie)
- Daily RPE
- Ratio białka (spożyte vs cel 160g)
- Konsekwencja treningowa (dni od ostatniego treningu)

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
6. Wzorce (vanguard_repeated_patterns, iron_rules)

Następnie: DeepSeek chat (tryb: `chat` / `planning` / `mirror`)

### Daily Strain — Jak się liczy

Wejście: Oura (cardio zones, sleep, readiness) + Strava (suffer_score) + RPE z PowerList
Wyjście: `daily_strain`
- `strain_score` (0–21, wzorowany na Whoop)
- `recovery_score` (0–100)
- `main_limiter` (sleep/kalorie/cardio_load/siłownia/mental_load)
- `daily_status` (green/yellow/red)

### Nutrition Coach — Logika

Codziennie 06:00:
- Szacuje TDEE na podstawie wagi, aktywności, celu (14% BF na 4.10.2026)
- Wylicza target_kcal z deficytem + protein_floor_g
- Verdict: `on_track` / `under` / `over`
- Zapis → `nutrition_targets`

### AI Goal Create — Przepływ

1. Użytkownik odpowiada na 5 pytań (cel, dlaczego, co musi się stać, blokery, działania tygodniowe)
2. POST → `vanguard-goal-create` z odpowiedziami + filarem + dniem dzisiejszym
3. DeepSeek → JSON: `{project_name, affirmation, kpis[], checkpoints[]}`
4. Preview w UI (możliwość "Zmień")
5. Confirm → INSERT do `projects` + `goal_kpis` + `project_checkpoints`

---

## Deprecated — Nie Używać

### Funkcje (zwracają 410)
- `vanguard-morning-brief`
- `vanguard-morning-ping`
- `vanguard-midday-check`
- `vanguard-friction-qa`
- `analyze-training`

### Tabele (nie pisać)
- `career_projects`, `career_moves`, `career_evidence`, `career_decisions`
- `vanguard_intentions`
- `intentions`

### Komponenty (usunięte)
- OuraWidget, OuraEnhanced, SleepDebtCard, MentorChat, GraphMind, ThoughtStream, IntentionTracker, ManifestationBoard, LocationTracker, AWImporter

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

*Ostatnia aktualizacja: 19.06.2026*
