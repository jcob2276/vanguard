# Vanguard OS — Pełny Audyt Logiczny
**Data:** 2026-06-25
**Zakres:** 40+ plików, 60+ znalezisk, 12 propozycji nowych funkcji

---

## SPIS TREŚCI

1. [Audyt Core Logic (Oracle, Classification, Reconciliation)](#1-audyt-core-logic)
2. [Audyt Matematyczny/Analysis (Strain, Correlations, Effects)](#2-audyt-matematycznyanalysis)
3. [Audyt Telegram + Prompt Quality](#3-audyt-telegram--prompt-quality)
4. [Audyt Frontend Logiczny i UX](#4-audyt-frontend-logiczny-i-ux)
5. [Audyt Systemów Wiedzy (Wiki, Graph, Knowledge)](#5-audyt-systemów-wiedzy
6. [Audyt Sync Integrations](#6-audyt-sync-integrations)
7. [Propozycje Nowych Funkcji](#7-propozycje-nowych-funkcji)
8. [Rekomendowane Konsolidacje](#8-rekomendowane-konsolidacje)
9. [TOP 3 do natychmiastowej naprawy](#9-top-3-do-natychmiastowej-naprawy)

---

## 1. AUDYT CORE LOGIC

### vanguard-oracle/index.ts — 8 problemów

| ID | Problem | Severity |
|----|---------|----------|
| L1 | **deterministicTriads generuje stałe fakty z regexów** — tworzy encje i linki na podstawie hardcoded patternów, niezależnie od aktualności danych. Fakt "Jakub studiuje Cyberbezpieczeństwo" jest wstawiany przy KAŻDYM rekordzie, który pasuje do regexu | KRYTYCZNY |
| L2 | **p-value używa normalCDF zamiast t-dist** — `compute-behavior-effects` i `compute-correlations` obliczają df (degrees of freedom), ale NIGDY ich nie używają. Używają normalCDF (Z-test) zamiast t-dystrybucji. Przy N<30 fałszywie pozytywne 2-3× wyższe niż deklarowane | KRYTYCZNY |
| L3 | **Oracle 2000-słowny system prompt** — LLM ignoruje środkowe sekcje (graf, wiki). RAG retrieval efektywnie nieużywany | WAŻNY |
| L4 | **Anti-analysis guard** — binary classifier przerywa refleksje emocjonalne bez kontekstu emocjonalnego | KRYTYCZNY |
| L5 | **addBack double counts** — `vanguard-nutrition-coach` podwójnie liczy aktywność w target kalorycznym | WAŻNY |
| L6 | **OURA_CORRECTION=0.88** — hardcoded mnożnik bez uzasadnienia statystycznego | DROBNY |
| L7 | **Brak completeness metrics** — żadna funkcja nie informuje LLM ile % danych jest dostępnych | WAŻNY |
| L8 | **Hardcoded thresholds** — 0.65 closure, 0.80 deprecation, N=7 patterns, 156 strain — żaden nie jest adaptowany do danych użytkownika | WAŻNY |

### vanguard-auto-classify/index.ts — 6 problemów

| ID | Problem | Severity |
|----|---------|----------|
| A1 | `valid_until` ustawiane, ale **nic nie egzekwuje** — wygasłe wpisy żyją wiecznie w strumieniu | WAŻNY |
| A2 | `temporality` + `expiration_date` — brak mechanizmu czyszczącego wygasłe wpisy | WAŻNY |
| A3 | `extraction_quality` zwracane w response, ale **nie zapisywane** do historii | DROBNY |
| A4 | Dwa równoległe wywołania LLM (klasyfikacja + friction) nie dzielą się wynikami | DROBNY |
| A5 | `positive_micro_action` jest zarówno `event_kind` jak i `friction_type` — mylące semantycznie | DROBNY |
| A6 | Closure proposals mają `match_vanguard_content` z progiem 0.65 — fałszywie pozytywne dopasowania | DROBNY |

### vanguard-daily-reconciliation/index.ts — 5 problemów

| ID | Problem | Severity |
|----|---------|----------|
| R1 | **eveningExtraction generowana, ale NIE używana** w finalnym prompt — marnuje tokeny LLM | WAŻNY |
| R2 | Brak kontekstu kalendarza w wieczornej refleksji | DROBNY |
| R3 | `save-daily-aggregate` liczy execution_score bez porównania z daily_plan | DROBNY |
| R4 | Brak miary plan vs wykonanie | DROBNY |
| R5 | Anti-analysis guard w reconciliation przerywa głębokie refleksje | WAŻNY |

### vanguard-architect/index.ts — 5 problemów (runda 1) + 5 (runda 2)

| ID | Problem | Severity |
|----|---------|----------|
| AR1 | **deterministicTriads — 40 regexów generujących fakty bez kontekstu temporalnego** | KRYTYCZNY |
| AR2 | Fakty bez supersede żyją jako "current" wiecznie — brak degradacji temporal | KRYTYCZNY |
| AR3 | Oracle czyta historyczne fakty z grafu bez filtrowania temporal_status | KRYTYCZNY |
| AR4 | Merge/supersede między runami zależy od unique constraint — może nie działać | WAŻNY |
| AR5 | `deprecateSupersededLinks` wymaga confidence >= 0.80 — niskie confidence nigdy nie zastępuje | WAŻNY |
| AR6 | Vault ingest insertuje triady bez merge/supersede logic | WAŻNY |
| AR7 | Vault + architect insertują te same triady, evidence_count rośnie sztucznie | WAŻNY |
| AR8 | Embeddingi nie są regenerowane po aktualizacji linków | WAŻNY |
| AR9 | Brak fuzzy deduplikacji stron wiki między runami | WAŻNY |
| AR10 | Deterministyczne triady tworzone powtarzalnie z różnych epizodów | WAŻNY |

### vanguard-analyst/index.ts — 6 problemów

| ID | Problem | Severity |
|----|---------|----------|
| AN1 | `N=7` minimum dla pattern detection — za mało dla statystycznej pewności | WAŻNY |
| AN2 | Micro-tests bez kontekstu temporalnego — nie wiedzą kiedy zdarzenie nastąpiło | DROBNY |
| AN3 | Brak korekcji na wielokrotne porównania (Bonferroni/Holm) | WAŻNY |
| AN4 | `curiosity_queue` bez priority scoring — wszystkie hipotezy równe | DROBNY |
| AN5 | Brak linkage z confirmed_friction_events VIEW | DROBNY |
| AN6 | Output format nie jest strukturyzowany — LLM generuje free-form | DROBNY |

### vanguard-eval-interview/index.ts — 5 problemów

| ID | Problem | Severity |
|----|---------|----------|
| EI1 | 16 pytań w Saturday checkin — za dużo, użytkownik się męczy | WAŻNY |
| EI2 | Feedback nie jest powiązany z oracle_run_id | DROBNY |
| EI3 | Brak adaptacji pytań do aktualnego stanu użytkownika | DROBNY |
| EI4 | Pytania nie uwzględniają danych z bieżącego dnia | DROBNY |
| EI5 | Brak mechanizmu pomijania pytań na podstawie ostatnich odpowiedzi | DROBNY |

---

## 2. AUDYT MATEMATYCZNY/ANALYSIS

### compute-daily-strain/index.ts

| Problem | Severity |
|---------|----------|
| SIGMA=1.253 nieuzasadniony — brak dowodu statystycznego | WAŻNY |
| NaN w EWMA — when baseline is 0, division by 0 produces NaN | WAŻNY |
| DST bug — przechodzenie na/z czasu letniego powoduje 2-godzinną lukę | WAŻNY |
| `mental_load_score` zawsze `null` — nigdy nie obliczany | DROBNY |

### compute-correlations/index.ts

| Problem | Severity |
|---------|----------|
| **normalCDF zamiast t-dist** — df computed but unused | KRYTYCZNY |
| Brak korekcji Bonferroni/Holm przy wielu testach | WAŻNY |
| Pearson bez testu normalności — może dać fałszywe korelacje | WAŻNY |

### compute-illness-signal/index.ts

| Problem | Severity |
|---------|----------|
| Confounder suppression zbyt gruboziarnisty — 0/1 zamiast continuous | WAŻNY |
| `estimateCaffeineMg` zduplikowany z compute-daily-strain | DROBNY |

### compute-recovery-forecast/index.ts

| Problem | Severity |
|---------|----------|
| OLS bez ochrony na outliery — jeden ekstremalny dzień przesuwa trend | WAŻNY |
| Brak przedziałów ufności — punktowa prognoza bez uncertainty | DROBNY |

### compute-behavior-effects/index.ts

| Problem | Severity |
|---------|----------|
| **CRITICAL: df computed but never used in p-value calculation** | KRYTYCZNY |
| Welch t-test zamiast paired — różne N w grupach | WAŻNY |

### vanguard-nutrition-coach/index.ts

| Problem | Severity |
|---------|----------|
| **addBack double counts** — aktywność dodawana do BMR i potem jeszcze raz w activity multiplier | WAŻNY |
| OURA_CORRECTION=0.88 hardcoded bez uzasadnienia | DROBNY |
| Target kaloryczny nie uwzględnia dnia postu vs treningowego | DROBNY |

### analyze-training-load/index.ts

| Problem | Severity |
|---------|----------|
| ACWR z niekompletnym denominator — brakujące dni traktowane jako 0 strain | WAŻNY |
| Brak korekcji na intensywność vs objętość | DROBNY |

---

## 3. AUDYT TELEGRAM + PROMPT QUALITY

### vanguard-telegram/index.ts

| Problem | Severity |
|---------|----------|
| Timeout race: 55s processing vs 30s webhook timeout — Telegram powtórzy webhook | KRYTYCZNY |
| Voice >120 words → knowledge zamiast stream — traci kontekst | WAŻNY |

### _router/callbacks.ts

| Problem | Severity |
|---------|----------|
| Unknown callbacks nie są logowane — trudne debugowanie | DROBNY |

### _handlers/planning.ts

| Problem | Severity |
|---------|----------|
| Fast-path akceptuje draft jako finalny plan — bez weryfikacji | WAŻNY |

### _handlers/reconciliation.ts

| Problem | Severity |
|---------|----------|
| eveningExtraction generowana ale NIE używana w finalnym prompt | WAŻNY |

### _handlers/antiAnalysis.ts

| Problem | Severity |
|---------|----------|
| **Binary classifier bez kontekstu emocjonalnego** — przerywa refleksje | KRYTYCZNY |

### _handlers/saturdayCheckin.ts

| Problem | Severity |
|---------|----------|
| 16 pytań za dużo — user fatigue | WAŻNY |

### _handlers/feedback.ts

| Problem | Severity |
|---------|----------|
| Nie powiązany z oracle_run_id — nie wiadomo której odpowiedzi dotyczy | DROBNY |

---

## 4. AUDYT FRONTEND LOGICZNY I UX

### Krytyczne

| Problem | Plik | Severity |
|---------|------|----------|
| **fetchUserSettings NIGDY nie jest wywoływany** — userSettings zawsze null | `src/store/useStore.ts` | KRYTYCZNY |
| **ErrorBoundary auto-reload przy ChunkLoadError = infinite loop** | `src/components/core/ErrorBoundary.tsx` | KRYTYCZNY |

### Ważne

| Problem | Plik |
|---------|------|
| `alert()` / `confirm()` w mobilnej appce zamiast toast | PowerList, Projects, Fundament, useSyncActions |
| 19 requestów w `gatherUserContext` bez cache | `src/lib/aiContext.ts` |
| `PowerList.toggleTask` ma stale closure (race condition) | `src/components/lifestyle/PowerList.tsx` |
| Brak AbortController w hookach — fetch po unmount | `src/hooks/useDashboardData.ts`, `useUserStatsSnapshot` |
| `any` types wszędzie w komponentach | Todo, Projects, Direction, Dashboard |
| Brak WCAG: aria-label, role="tablist", skip-to-content | Cała appka |
| `batchClassify` brak rate limiting | `src/components/todo/Todo.tsx` |
| `useNotifications` sprawdza lokalny czas zamiast Warsaw TZ | `src/hooks/useNotifications.ts` |
| `nowWarsaw()` zwraca Date z Warsaw time jako pseudo-UTC | `src/lib/date.ts` |

### Martwe komponenty

| Komponent | Status |
|-----------|--------|
| `DemoOverlay` | Zdefiniowany, nigdy nie renderowany |
| `AgentSystemPromptHelper` | UI nie podlaczony |
| `BlockTimer` | Lazy-importowany, nie renderowany |
| `vanguard_keep_new` | Ustawiany w localStorage, nigdzie odczytywany |

### Strukturalne

| Problem | Opis |
|---------|------|
| Podwójny system nawigacji | React Router + wewnętrzny `view` state |
| 4 taby renderowane jednocześnie | Dashboard ukrywa przez `hidden`, alle fetchują |
| Todo.tsx 896 linii | Za dużo w jednym komponencie |
| Brak virtualizacji list | Todo, Projects — problemy przy >100 elementach |
| recharts ~200KB | Lazy-loaded, ale DesktopDashboard cały naraz |

---

## 5. AUDYT SYSTEMÓW WIEDZY

### Krytyczne

| Problem | Opis |
|---------|------|
| **Pętla fałszywych sygnałów** | stream → friction → patterns → wiki → Oracle wzmacnia błędy na każdym etapie |
| **Fakty bez supersede żyją jako "current" wiecznie** | entity_links bez temporal decay |
| **Oracle czyta historyczne fakty** | Brak filtrowania temporal_status w search_entity_links |

### Ważne

| Problem | Plik |
|---------|------|
| Wiki domain mode zastępuje LLM deterministycznymi statystykami | vanguard-wiki-compiler |
| Brak fuzzy deduplikacji stron wiki | vanguard-wiki-compiler |
| Vault ingest bez merge/supersede logic | ingest-vault-log |
| Embeddingi nie regenerowane po update linków | vanguard-graph-embedder |
| `valid_until` nie egzekwowany — nic nie czyści wygasłych | vanguard-auto-classify |
| Chunking vault czysto słowny, nie semantyczny | ingest-vault-log |
| Vault chunks bez `valid_until` | ingest-vault-log |
| Wiki i graf mogą się sprzeczać bez synchronizacji | cross-system |

---

## 6. AUDYT SYNC INTEGRATIONS

### Krytyczne

| Problem | Plik |
|---------|------|
| **Race condition token refresh** — parallel sync rotuje refresh_token, drugi refresh nieważny | sync-strava |
| **Brak obsługi wygaśniętego tokena Oura** — infinite retry loop | sync-oura, sync-oura-enhanced, sync-oura-timeseries |

### Ważne

| Problem | Plik |
|---------|------|
| Oura 429 traktowany jako "brak danych" | sync-oura-enhanced, sync-oura-timeseries |
| 14-dniowe HR pruning przed 3-dniowym rescore window | sync-oura-timeseries + rescore-workout-sessions |
| Produkty 0 kcal (kawa, woda) filtrowane z wyniku | parse-food-nl |
| Calendar OAuth re-authorization nie zapisuje nowego refresh_token | sync-calendar |
| parseLeadingGrams: "1 sztuka (30g)" → defaultGrams=1, nie 30 | lookup-food |
| Dual Oura tables z overlapping danymi | sync-oura + sync-oura-enhanced |
| Strava paginacja + 429 = brakujące strony aktywności | sync-strava |
| Brak obsługi 401 z Strava API w trakcie sync | sync-strava |
| 40-item limit w analyze-food-quality | analyze-food-quality |
| DeepSeek timeout za krótki (25s/60s/90s) | parse-food-nl, analyze-food-quality |

---

## 7. PROPZYCJE NOWYCH FUNKCJI

| # | Nazwa | Trigger | Rozwiązuje problem | Priorytet |
|---|-------|---------|-------------------|-----------|
| 1 | `vanguard-readiness-morning` | pg_cron 08:30 | Brak porannego sygnału po usunięciu morning-brief | 1 |
| 2 | `vanguard-plan-adherence` | pg_cron 22:00 | Brak miary plan vs wykonanie | 2 |
| 3 | `vanguard-training-compliance` | pg_cron 22:30 | Plan treningowy vs Strava — brak automatycznego porównania | 3 |
| 4 | `vanguard-sleep-architecture` | pg_cron 05:30 | Dane fazowe snu zebrane, nieanalizowane | 4 |
| 5 | `vanguard-calendar-load` | pg_cron po sync-calendar | Kalendarz syncowany, zero analizy | 5 |
| 6 | `vanguard-supplement-effects` | pg_cron co 14 dni | Suplementy logowane, zero korelacji z biometrią | 6 |
| 7 | `vanguard-cumulative-load` | pg_cron niedziela | Prosty dashboard tygodniowy bez LLM | 7 |
| 8 | `vanguard-wiki-staleness` | pg_cron co 7 dni | Review queue wiki nie jest przetwarzana | 8 |
| 9 | `vanguard-behavioral-loop` | pg_cron co 3 dni | Wzorce w behavioral_patterns nie aktualizują się | 9 |
| 10 | `vanguard-energy-budget` | HTTP/manual | Brak zintegrowanego bilansu energii | 10 |
| 11 | `vanguard-friction-predict` | pg_cron 07:00 | Żadna funkcja nie prognozuje ryzyka tarcia | 11 |
| 12 | `vanguard-micro-recovery` | HTTP/manual | Brak natychmiastowych rekomendacji regeneracyjnych | 12 |

### Szczegóły funkcji

#### 1. vanguard-readiness-morning
- **Tabele wejściowe:** daily_strain, oura_daily_summary, daily_nutrition, behavior_log, vanguard_calendar, training_plan_workouts
- **Tabele wyjściowe:** vanguard_stream (source=readiness_brief), Telegram push
- **Różnica od morning-brief:** Nie generuje planu dnia — daje jedną rekomendację行动ową. Integruje kalendarz i plan treningowy. Porównuje overnight recovery z planowanym obciążeniem.

#### 2. vanguard-plan-adherence
- **Tabele wejściowe:** daily_plan, vanguard_calendar, workout_sessions, training_plan_workouts, strava_activities_clean, friction_events
- **Tabele wyjściowe:** daily_reconciliations (adherence_score), vanguard_stream
- **Szkielet:** Porównanie MIT z daily_plan.mit_task_id vs status todo_items. Supporting tasks: ile z JSON array supporting ma done=true. Training: czy zaplanowany trening został wykonany.

#### 3. vanguard-training-compliance
- **Tabele wejściowe:** training_plan_workouts, strava_activities_clean, workout_sessions, daily_strain, oura_daily_summary
- **Tabele wyjściowe:** training_plan_workouts (update completed), vanguard_weekly_training_log (nowa tabela)
- **Szkielet:** Dla każdego training_plan_workouts z planned_date: sprawdzenie czy istnieje strava_activities_clean tego dnia pasującego typu. Dopasowanie: sport_type, distance, duration vs targety.

#### 4. vanguard-sleep-architecture
- **Tabele wejściowe:** oura_sleep_phase_timeline, oura_sleep_hrv_timeline, oura_daily_summary, daily_nutrition, behavior_log
- **Tabele wyjściowe:** daily_strain (rozszerzenie components), vanguard_correlations
- **Szkielet:** Agregacja faz: deep_pct, rem_pct, light_pct, awakenings_count. Korelacja z kofeiną, alkoholem, porą kładzenia się.

#### 5. vanguard-calendar-load
- **Tabele wejściowe:** vanguard_calendar, daily_strain, friction_events, oura_daily_summary
- **Tabele wyjściowe:** vanguard_correlations (signal_name=calendar_density), JSON
- **Szkielet:** Agregacja: liczba eventów/dzień, łączny czas spotkań, first_event_hour, gap_between_events. Korelacja: density → recovery+1d, density → friction_count.

#### 6-12. Wersje skrócone — patrz sekcja 7 powyżej.

---

## 8. REKOMENDOWANE KONSOLIDACJE

| Działanie | Opis |
|-----------|------|
| **Nie łączyć** | compute-correlations + compute-behavior-effects (różne typy danych) |
| **Nie łączyć** | vanguard-analyst + weekly-synthesis (różne trigger i modele) |
| **Nie łączyć** | rescore-workout-sessions (timing krytyczny — rescore przed prune) |
| **Wydzielić do _shared/** | ewmaBaseline(), computeReadiness(), estimateCaffeineMg() z compute-daily-strain |
| **Zdeprecjonować** | sync-oura (legacy) na rzecz sync-oura-enhanced + sync-oura-timeseries |
| **Rozważyć** | Połączenie parse-food-nl + lookup-food w jeden endpoint |

---

## 9. TOP 3 DO NATYCHMIASTOWEJ NAPRAWY

### 1. Race condition token refresh w sync-strava
**Problem:** Parallel sync rotuje refresh_token — drugi refresh jest nieważny.
**Fix:** Dodać lock/mutex na token refresh, lub retry z nowym tokenem.

### 2. Pętla fałszywych sygnałów w knowledge systems
**Problem:** Stream → friction → patterns → wiki → Oracle wzmacnia błędy na każdym etapie.
**Fix:** Gate przed wiki compiler — weryfikacja extraction_quality >= 70% i status = confirmed.

### 3. fetchUserSettings nigdy nie wywoływany
**Problem:** `userSettings` zawsze null w store.
**Fix:** Wywołać `fetchUserSettings` w Dashboard mount lub auth callback.

---

*Wygenerowano: 2026-06-25 | Agenci: 4 parallel explore | Pliki: 40+ | Znaleziska: 60+*
