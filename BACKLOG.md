# Vanguard OS — Backlog

Jedyny backlog w repo. Wszystko odłożone, nieukończone lub zaplanowane żyje tutaj —
nie w osobnych plikach per temat. Gdy plan/sesja się kończy, otwarte punkty lądują
tutaj przed skasowaniem pliku planu (patrz `AGENTS.md`, sekcja "Reguły dokumentacji").

**Przed kodem:** `AGENTS.md` → `docs/ARCHITECTURE.md` → `supabase/functions/README.md`

**Aktualny stan pracy w toku (co robi agent teraz):** [`docs/agent/ACTIVE_WORK.md`](docs/agent/ACTIVE_WORK.md).
Ten plik (`BACKLOG.md`) to kolejka — rzeczy jeszcze nierozpoczęte albo wstrzymane.

---

## Jak z tym pracować

- Odhaczaj `[x]` po zamkniętym punkcie, nie usuwaj wiersza od razu — usuń przy najbliższym porządkowaniu sekcji.
- Nowy punkt dopisuj do właściwej części, nie na końcu pliku.
- Części I–II (audyt architektury + warstwa wiedzy) mają **twardą kolejność zależności** — nie przeskakuj.
- Części III+ to checklisty niezależnych punktów — rób w dowolnej kolejności w ramach priorytetu.

---

# Część I — Audyt architektury 2026-07 (sekwencja z zależnościami)

> Zebrane z sesji audytowej 2026-07-07. Kolejność = graf zależności, nie ranking ważności. Sekcje "Część II" niżej to pełny opis pozycji z Fazy 1.5–5.

## Faza 0 — Bezpieczeństwo i domknięcie sesji (rób pierwsze, zawsze)

1. **Backup** — nocny `pg_dump` (GitHub Action cron) + kopia bucketów (`progress-photos`, `todo-attachments`) + test odtworzenia na czystym projekcie.
2. **Zielony typecheck na main** — `catch (e)` bez typu w `usePowerListData` (×3), `CalendarView:805`, typy `calendar-write`. Rób razem z Priorytetem 1 z Części III (`InsightsDashboard.tsx`, `GrowthView.tsx`, `PatternCard.tsx` — ten sam typ buga, jeden sweep).
3. **Git** — czysty working tree przed każdą fazą.
4. **`gatherUserContext`** — usuń z `OracleCard:351` i z `usePowerListData` na raz (ten sam wzorzec, 15 zapytań do kosza przy każdym otwarciu).
5. **Sekrety/URL placeholdery w migracjach — pełny sweep.** `grep -rn "YOUR_PROJECT_REF\|YOUR_.*_KEY\|YOUR_.*_SECRET" supabase/migrations` i napraw wszystkie trafienia w jednej sesji. Znane: cron `metabolism` (`YOUR_SERVICE_ROLE_KEY`), `trigger_daily_snapshots` (URL z `YOUR_PROJECT_REF`).
6. **Deploy + migracje zaległe** (`realtime_publication`, `metabolism_flag`, cron) + deploy `oracle`/`executor`/`metabolism`.
7. **Test dwóch magii** — task z Telegrama pojawia się sam w otwartej apce; odpowiedź Oracle płynie strumieniem.
8. **`VANGUARD_USER_ID` fail-fast** — wyjątek zamiast fallbacku na usera-ducha `0000...`.

## Faza 1 — Strażnicy procesu (tydzień 1)

9. **Reguły agentów w `AGENTS.md`/`FRONTEND_GUIDE.md`** + ESLint jako prawo: `max-lines` 300/150, `no-explicit-any: error`, lista LEGACY-wyjątków która może tylko maleć. Egzekucja per plik przy dotyku (zasada skauta), nie jednorazowy sweep całego repo.
10. **Knip do CI** + wyczyścić martwe pliki/eksporty, które wskaże.

## Faza 1.5 — Knowledge Leverage, Priorytet 1

Wykonaj w tej kolejności (§1.3 wymaga §1.1 jako warunku) — pełny opis w Części II §1.1–§1.3:
1. **[x] §1.1** Write-back `proposed_memory` z ClarificationRequest do grafu wiedzy — największa dźwignia/koszt całego audytu (~1 wieczór).
2. **[x] §1.2** Kalibracja prognoz (Brier/MAE) — metryka nadrzędna.
3. **[x] §1.3** Pompa active learning.

## Faza 2 — Domknięcie rozliczeń

Pełny opis w Części II §2.1–§2.3:
1. **[x] §2.3** Nightly pipeline ledger.
2. **[x] §2.2** `vanguard-backtester` — krok 2-3 dopiero PO §2.1 i bitemporalności z Fazy 4.
3. **[x] §2.1** Rada Oracle'a jako obiekt.
4. **Backfill/replay dla danych pochodnych** — `runComputeDailyStrain` i `metrics_*` przyjmują tylko "dziś". Dodaj `dateFrom/dateTo`, nightly dostaje tryb `?backfill=X..Y`. Rób razem z `algo_version` (Faza 4) — jedna migracja, jeden PR.

## Faza 3 — Model pojemności + struktura frontendu

1. (częściowo) Część II §7.1 — 10 z ~31 ręcznych `useEffect+useState` hooków zmigrowanych na react-query. Zostały głównie "god hooki" (`useWorkoutLogger`, `usePowerListEffects`, `useNutritionData` — 5 konsumentów) i debounced search (`useFoodEntrySearch`) — świadomie odłożone, wymagają dedykowanej sesji.
4. (częściowo) Offline write queue — `lib/offlineQueue.ts` pokrywa 6 domen. Luka: `dreamsApi.ts`, `calendarApi.ts`, `kpiTrendApi.ts` mają zero pokrycia offline.

## Faza 4 — Graf wiedzy i backtester (przy najbliższym dotknięciu architekta/wiki-compilera)

Część II §4.1–§4.9, w tej kolejności:
1. **§4.6** Tabela encji — sprawdź najpierw `vanguard_entity_aliases` (martwa, patrz Część III write-orphany) zanim zbudujesz nową.
2. **§4.5** Bitemporalność (`learned_at`) — rób razem z `algo_version` i backfill/replay z Fazy 2.
3. **§4.1** Warstwa `claims` jako nadrzędna nad graf/wiki/fundament.
4. **§4.2** Korelacje/patterns emitują claims.
5. **§4.3 + §4.4** `outcome_metric` per pattern + fix `user_id` w `outcomes.ts`.
6. **§4.7** Dossier celu.
7. **§4.8** Tygodniowy diff self-modelu.
8. **§4.9** 4 Lenses do promptu — 15 minut, tylko tekst.

## Faza 5 — Uczciwość danych, ludzie/świat zewnętrzny, ostatnie mile

Część II §5.1–§5.6 (braki danych, coverage metryk, korekty LLM, cykliczność, pogoda, confoundery) i §6.1–§6.2 (maraton jako obiekt, raport dla trenera Igora):
- `dream_id` auto-sugestia albo wycięcie.
- [x] Cmentarz martwych tabel (schemat `graveyard`, po row-count) + regeneracja `database.types.ts`.
- Jeden przełyk capture (Telegram/share/skróty/voice = aliasy jednej rury).
- Telemetria `view_events`.
- keep-triage → LinksInbox auto-tagowanie.
- Cele żywieniowe → `MorningPlanModal`.
- Panel zdrowia systemu z `audit_events` — bundle z §5.2 (licznik pokrycia metryk).
- Sprzątanie repo (`.mimocode`, `screeny/`, `PRPs/`, `examples/`, skrypty jednorazowe).

**[x] Budżet/kolejka powiadomień:** co najmniej 8 funkcji woła Telegram API bezpośrednio, bez wspólnej bramki. Tabela `outbound_messages(priority, dedupe_key, send_after)` + jeden worker wysyłający — zaimplementowane w `_shared/infra/telegram/send.ts` i `vanguard-outbox-sender`.

## Frontend Code Debt — wyniki audytu 2026-07-16

> Dane z rzeczywistego audytu. Rób przy dotyku pliku (zasada skauta), nie jednorazowym sweepem.

### Pliki >300 linii bez dokumentowanego wyjątku (priorytet: split przy najbliższym dotknięciu)

| Plik | Linie | Co z tym zrobić |
|---|---|---|
| `lifestyle/hooks/usePowerListActions.ts` | 437 | Hook — podziel na useActions + useMutations |
| `todo/TodoCard.tsx` | 426 | [x] Rozbite na TodoCard.tsx i TodoCardCollapsedRow.tsx |
| `notes/EditNoteModal.tsx` | 419 | Duży, ale gęsty — przy następnej dużej zmianie split |
| `core/hooks/useDashboardState.ts` | 416 | God hook — podziel domenowo |
| `medical/EndMyopiaCalculator.tsx` | 413 | Samodzielny kalkulator, można split na logikę + widok |
| `growth/hooks/useGrowthData.ts` | 402 | Hook mieszający fetch z transformacją |
| `projects/ProjectCardExpanded.tsx` | 363 | Miesza dane + JSX → split |
| `biometrics/hooks/useWorkoutLogger.ts` | 349 | God hook — podziel domenowo |
| `core/nutrition/hooks/useFoodEntryActions.ts` | 341 | Hook akcji — OK, ale sprawdź przy dotyku |
| `desktop/fitness/fitnessScoreUtils.ts` | 328 | Util — OK do zostania jeśli czysta logika |

**Reguła:** pliki hooks >300 linii ZAWSZE wymagają uzasadnienia lub podziału. Pliki *.tsx >300 linii ZAWSZE wymagają podziału na Container + View LUB dokumentowanego `/* eslint-disable max-lines */` z wyjaśnieniem.

### Inline date formattery (toLocaleDateString) poza kanonicznymi wrapperami

Znalezione w audycie pliki z inline `toLocaleDateString('pl-PL', ...)` — przy dotyku zastąp odpowiednim helperem z `lib/date.ts` lub modułowego utils:

- `ai/ChatItems.tsx` (L35, L39) — [x] Plik usunięty podczas refaktoryzacji widoków AI
- `desktop/fitness/MarathonPanel.tsx` (L51) — [x] Zastąpione przez formatLongDateWarsaw
- `integrations/StravaWidget.tsx` (L45) — [x] Zastąpione przez formatShortDateWarsaw
- `notes/EditNoteModal.tsx` (L91) — do naprawienia przy następnym refaktorze
- `notes/InlineEditor.tsx` (L150) — do naprawienia przy następnym refaktorze

Kanoniczne helpery: `keepUtils.relativeDate` (notatki), `todoUtils` (todo), `calendarHelpers` (kalendarz), `lib/date.ts` (wszystko inne).

---

## Ciągłe / bez końca (zasada skauta — nie osobna sesja per punkt)

- **LLM gateway + rejestr promptów**, rozszerzony o: centralizację sekretów (`DEEPSEEK_API_KEY` czytany bezpośrednio w ~30 plikach zamiast przez `_shared/config.ts`) i tier wrażliwości danych.
- Reszta punktów ciągłych — wykonuj przy dotyku odpowiedniego modułu.

**Zasada zamykająca Części I:** po Fazie 1.5 (§1.2 — kalibracja prognoz) masz obiektywny sygnał, czego jeszcze brakuje — jeśli krzywa błędu predykcji się wypłaszcza, dokładaj nowy sensor. Nie odwrotnie.

---

# Część II — Warstwa wiedzy i dźwigni (Knowledge Leverage)

> System już zbiera dane o Jakubie — pytanie tej części to czy faktycznie wie to, co zbiera, i czy się z tego rozlicza. Wspólny wzorzec każdej pozycji: **zero nowego codziennego inputu od Jakuba** — złączenie/domknięcie klocków, które już istnieją w kodzie.

Kanoniczny flow wiedzy:

```
Telegram / voice / manual ingest
        │
        ▼
  vanguard_stream          ← surowa ewidencja użytkownika (source of truth)
        │
        ├──► vanguard-auto-classify  → friction_events (jedyny pipeline tarcia)
        ├──► vanguard-architect (batch) → vanguard_entity_links (graf wiedzy — triady)
        ├──► vanguard-wiki-compiler → vanguard_wiki_pages (skompilowana pamięć, derived)
        └──► ingest-vault-log (long-form) → stream chunks + graf RPC

READ path: Oracle czyta graf + wiki + world_state + stream
Nightly: agreguje dzień, liczy strain/illness/recovery, wykrywa patterny, liczy korelacje
```

Kluczowe tabele: `vanguard_entity_links` (graf, triady z `confidence_score`, `status`, `superseded_by`), `vanguard_wiki_pages` (derived, `source_refs`), `vanguard_wiki_review_items` (kolejka do przeglądu), `oracle_clarification_requests` (pytania Oracle do Jakuba), `vanguard_daily_aggregates`, `vanguard_behavioral_patterns` + `pattern_events`, `vanguard_oracle_runs` (read-only telemetria), `behavior_log` (confoundery).

**Konstytucyjna zasada:** Oracle NIE zapisuje do grafu/wiedzy automatycznie w każdej turze rozmowy — celowo wyłączone w Sprint 0.7. Każda propozycja poniżej dotycząca zapisu do grafu MUSI przechodzić przez bramkę potwierdzenia człowieka (ClarificationRequest, §1.1).

## 🥇 Priorytet 1 — najwyższa dźwignia, najniższy koszt

### §1.1 Write-back `proposed_memory` z ClarificationRequest do grafu wiedzy

**Problem:** `ClarificationRequestCard.tsx:65` po odpowiedzi robi tylko `.update({status:'answered', answer, answered_at})`. `proposed_memory` — fakt który Jakub właśnie POTWIERDZIŁ — nie ląduje nigdzie jako trwały fakt. Po kilku tygodniach kontekst wypadnie z okna i fakt zniknie.

**Dlaczego najwyższa dźwignia:** to jest dokładnie bramka "human confirmation przed zapisem do grafu", której zabrakło przy amputacji Sprint 0.7. Nie trzeba jej projektować od zera — istnieje, tylko ostatni drut nie jest podłączony.

**Co zbudować:**
1. Po `status: 'answered'`, tylko gdy odpowiedź faktycznie potwierdza `proposed_memory`: insert do `vanguard_entity_links` z `source_entity`/`target_entity`/`relation`, `confidence_score: 0.95`, `status: 'active'`, `source: 'user_confirmed_clarification'`, `learned_at: now()`.
2. Kolizja z istniejącym aktywnym faktem → oznacz stary jako `superseded` przez `_shared/deprecateSupersededLinks.ts`.
3. Test: odpowiedz na jedno pytanie Oracle w UI, sprawdź nowy wiersz w `vanguard_entity_links`.

**Koszt:** ~1 wieczór.

### §1.2 Kalibracja prognoz — metryka nadrzędna dla całej reszty audytu

**Problem:** system twierdzi (Oracle, wiki, patterns), że "rozumie" Jakuba, ale nic tego nie weryfikuje. Scope-gates na predykcje uchylone 2026-07-02, brak jakiejkolwiek `predicted_*` w `database.types.ts`.

**Co zbudować:**
1. Tabela `vanguard_daily_predictions`: `user_id`, `date`, `predicted_at`, `metric` (`sleep_hours`/`readiness_score`/`execution_score`), `predicted_value`, `predicted_interval_low/high`, `actual_value`, `error`.
2. Krok w `vanguard-nightly`: generuj predykcję na jutro (średnia ważona 7 dni + trend, LLM niekonieczny).
3. Następnego dnia: uzupełnij `actual_value` z `vanguard_daily_aggregates`/`oura_daily_summary`, policz błąd.
4. Po miesiącu: dashboard z Brier score/MAE. Malejący błąd = self-model się uczy. Płaski/rosnący = sygnał czego brakuje.

### §1.3 Pompa active learning: `vanguard_wiki_review_items` → `oracle_clarification_requests`

**Problem:** `vanguard-wiki-compiler` już generuje `ReviewDraft` do `vanguard_wiki_review_items`, ale nic jej nie konsumuje. `vanguard-eval-interview` zadaje generyczne pytanie, nie oparte na tym czego system jest niepewny.

**Co zbudować:**
1. W `vanguard-eval-interview` lub nowym kroku nightly: weź top 1-2 nieprzejrzane z `vanguard_wiki_review_items` (po `severity`) lub `vanguard_entity_links` z `confidence_score < 0.7`, najstarszy `created_at`.
2. Wygeneruj `oracle_clarification_request` (reużyj `saveClarificationRequest`), `dedupe_key` zapobiega duplikatom.
3. **§1.1 musi być zrobione przed tym punktem.**

## 🥈 Priorytet 2 — domyka pętle rozliczenia

### §2.1 Rada Oracle'a jako obiekt, nie gaz

**Problem:** `systemPrompt.ts:93` definiuje `"fact | hypothesis | recommendation"`, ale żadna rekomendacja nie jest obiektem z warunkiem/metryką sukcesu/oknem ewaluacji.

**Co zbudować:**
1. Tabela `oracle_recommendations`: `id`, `oracle_run_id` (FK), `recommendation_text`, `related_metric`, `success_threshold`, `evaluation_window_days`, `status`, `outcome`.
2. Gdy Oracle emituje `type: "recommendation"` — zapisz (rozszerz `logOracleRun`).
3. Auto-ewaluacja: skopiuj wzorzec z `_shared/nightly/outcomes.ts` (`runPatternOutcomes`) — windowed join.

### §2.2 `vanguard-backtester` — katalog jest pusty

Zero plików źródłowych w `supabase/functions/vanguard-backtester`. **Dopiero PO §2.1 i §4.5** (bitemporalność) — inaczej backtester nie ma czego oceniać uczciwie (przeciek przyszłej wiedzy do przeszłości).

### §2.3 Nightly nie ma księgi przebiegów (ledger)

**Problem:** `vanguard-nightly/index.ts:79-89` — każdy krok owinięty w `.catch(e => console.error(e))`, pipeline leci dalej. Jeśli krok 3 padnie, `world_state` na końcu wygląda świeżo.

**Co zbudować:**
1. Tabela `vanguard_pipeline_runs`: `run_id`, `step_name`, `status`, `started_at`, `finished_at`, `error_message`.
2. W `vanguard-nightly/index.ts` — opakuj każdy krok helperem zapisującym wpis przed/po.
3. Heartbeat czyta ten ledger, nie testuje HTTP bezpośrednio.

## 🥉 Priorytet 3 — model pojemności

### §3.1 Zadania nie mają kosztu

`todo_items` nie ma kolumny effort/energy/duration. `dailyPlanProposal.ts` widzi `readinessScore`/`recoveryScore`, ale nie ma czym tego wykorzystać — zadania nie deklarują ile kosztują.

**Co zbudować:**
1. Migracja: `estimated_effort` (enum `light/medium/heavy`) do `todo_items`.
2. `vanguard-todo-extract`/`vanguard-todo-classify` — dodaj pole do istniejącego promptu klasyfikującego.
3. `dailyPlanProposal.ts` — sumuj effort proponowanych zadań, porównaj z pojemnością dnia.

## Graf wiedzy — pozycje strukturalne

### §4.1 Warstwa `claims` jako nadrzędna nad graf/wiki/fundament

**Problem:** pięć niezależnych magazynów wiedzy o Jakubie: `vanguard_entity_links`, `vanguard_wiki_pages`, `user_fundament`, `vanguard_preferences`, beliefs z `vanguard-metabolism` (hack: string wciśnięty w niepasujący kształt triady). Oracle sklejam wszystkie pięć konkatenacją tekstu bez referencji ani wspólnego confidence.

**Co zbudować (przy okazji dotykania architekta/wiki-compilera, nie osobną sesją):** kanoniczny obiekt `claim` (treść, typ `fact`/`hypothesis`/`belief`/`preference`/`correlation`, confidence, `evidence_refs`, ważność w czasie, `learned_at`). Kierunek migracji, nie big-bang rewrite.

### §4.2 Korelacje/patterns nie emitują wiedzy do grafu

`correlationCatalog.ts` ma ~80 metryk numerycznych, `vanguard-architect` ekstrahuje triady z tekstu — te dwa światy nigdy się nie widzą.

**Co zbudować:** krok w `vanguard-nightly` po `runComputeCorrelations` — istotne statystycznie korelacje emitują wpis do `claims`/`vanguard_entity_links` z `memory_type: 'correlation'`, `relation: 'koreluje_z'`.

### §4.3 `pattern_events` oceniane jedną uniwersalną metryką

`_shared/nightly/outcomes.ts` `runPatternOutcomes` ocenia SUKCES każdego patternu wyłącznie przez `execution_score >= 0.80`, niezależnie od domeny (sen, trening, jedzenie).

**Co zbudować:** kolumna `outcome_metric` na `vanguard_behavioral_patterns` (z `correlationCatalog.ts`). W `outcomes.ts` zamień hardkodowane `execution_score` na dynamiczny lookup. Rób razem z §4.4.

### §4.4 Bug: brak filtra `user_id` w `outcomes.ts`

`outcomes.ts:29-33` — zapytanie do `vanguard_daily_aggregates` bez `.eq('user_id', userId)`. Napraw przy okazji §4.3.

### §4.5 Brak bitemporalności — backtester będzie oszukiwał

`vanguard_entity_links` nie rozróżnia `valid_at` (kiedy to było prawdą) vs `learned_at` (kiedy system się dowiedział). Backtester oceniający radę z 15 maja może skorzystać z wiedzy zdobytej w czerwcu.

**Co zbudować:** kolumna `learned_at` (domyślnie `created_at`) na `vanguard_entity_links`. **Zrób PRZED napisaniem backtestera od zera** (§2.2), razem z `algo_version`.

### §4.6 Graf jest stringowy, nie encyjny

`vanguard-architect/extraction/processor.ts:44` — dedup encji to instrukcja w prompcie LLM, nie tabela. `vanguard_entity_links` trzyma source/target jako gołe stringi.

**Co zbudować:** tabela `vanguard_entities`: `id`, `canonical_name`, `aliases` (text[]), `entity_type`, `embedding`. **Uwaga:** `vanguard_entity_aliases` już istnieje w bazie, ale jest martwa (porzucony resolwer) — sprawdź ją PRZED tworzeniem nowej tabeli.

### §4.7 Dossier celu

`vanguard-wiki-compiler` — nowy `page_type: 'goal'`. Dla każdego aktywnego `life_goal` kompiluj: relevantne korelacje, twierdzenia z grafu (przez encje z §4.6), eksperymenty, checkpointy, trend metryki vs gap do celu. Złączenie istniejących danych, nie nowe źródło.

### §4.8 Tygodniowy diff self-modelu

Krok w `vanguard-weekly-synthesis` — wiersze `vanguard_entity_links` z `created_at`/`superseded_at` w ostatnim tygodniu → krótkie podsumowanie ("3 nowe twierdzenia, 1 nadpisane: X→Y"). Prefill do `WeeklyReviewModal`.

### §4.9 4 Lenses — 15 minut roboty

Hidden Contexts, Energy Tides, Micro-Consistency, Interactive Curiosity — dodaj jako instrukcję do system promptu `vanguard-analyst` i/lub Oracle. Zero nowego kodu poza tekstem promptu.

## Uczciwość danych — braki i skażenia próby

### §5.1 Braki danych nie są rozróżnialne od zdarzeń

Dzień bez zalogowanego posiłku wygląda identycznie jak dzień głodówki. Brak wpisu w `behavior_log` wygląda jak "na pewno nie wystąpiło", nie "nie wiadomo".

**Co zbudować:** jedno tapnięcie przy powrocie po przerwie w logowaniu (>2 dni bez wpisu) z pytaniem "przerwa: OK / chory / podróż" → `behavior_log`. Silnik korelacji wyklucza oznaczone okna.

### §5.2 Licznik pokrycia metryk — cicha śmierć rur danych

Katalog ma ~80 metryk, nic nie mierzy jaki % dni każda faktycznie ma wartość. Rura, która się zepsuje, głoduje po cichu.

**Co zbudować:** krok w `vanguard-nightly` liczący % dni z niepustą wartością (30 dni) per metryka → `metric_coverage_stats` lub `audit_events`. Panel zdrowia systemu.

### §5.3 Korekty LLM giną bezpotomnie

Gdy Jakub poprawia output LLM, poprawka nadpisuje wiersz — nic nie rejestruje że to była korekta BŁĘDU (vs zwykła edycja).

**Co zbudować:** kolumna `corrected_from` (JSON) na tabelach z edytowalnym LLM outputem.

### §5.4 Zero obsługi cykliczności w silniku korelacji

`correlationEngine.ts` — zero wzmianki o dniu tygodnia/sezonie. Sesja egzaminacyjna (semestr PRz) zawsze traktowana jako świeża anomalia.

**Co zbudować:** cechy cykliczne (`day_of_week`, `days_to_exam`) jako metryki pierwszej klasy w `correlationCatalog.ts`. Opcja stratyfikacji w silniku korelacji.

### §5.5 Pogoda i fotoperiod nie karmią korelacji

Pogoda widoczna w kalendarzu, ale nie w `correlationCatalog.ts`.

**Co zbudować:** integracja Open-Meteo (nightly) — temperatura, ciśnienie, godziny światła → `daily_weather` → do katalogu korelacji. Priorytet: pora zasypiania (~01:00) to problem zdrowotny #1.

### §5.6 Analityka bez modelu confounderów

`behavior_log` ma kolumny na confoundery (alkohol, choroba, podróż, stres), silnik korelacji liczy surowe pary bez stratyfikacji.

**Co zbudować:** minimalna wersja — flaga w `evidence_text`. Pełna wersja — stratyfikacja: licz korelację osobno dla dni z/bez confoundera.

## Ludzie i świat zewnętrzny

### §6.1 Maraton nie istnieje jako obiekt w systemie

Kontekst: VO2max 47.1, cel sub-4h Koszyce 2026-10-04, trener Igor, gap +2.9 do celu, PR 1K 4:25.

**Co zbudować:** dossier wyścigu (instancja §4.7). Krok w nightly: prognoza czasu maratonu z ostatnich biegów (formuła Riegela), planned-vs-executed treningu, countdown do 2026-10-04.

### §6.2 Vanguard jest single-player, cel #1 ma drugiego gracza

Zero interfejsu dla trenera. Igor programuje trening na ślepo/ustnie, podczas gdy Vanguard codziennie liczy strain/recovery/illness/RPE.

**Co zbudować:** cotygodniowy raport dla trenera (link/PDF/Telegram-forward): trend objętości, recovery, flagi choroby/przemęczenia, RPE rzeczywiste vs zaplanowane. Zero nowego inputu od Jakuba.

## Kolejność wykonania Części II

1. **§1.1** (1 wieczór, odblokowuje ścieżkę zamkniętą od Sprint 0.7).
2. **§1.2** (metryka nadrzędna — po niej wiadomo, czego brakuje).
3. **§1.3** (wymaga §1.1).
4. **§2.3** (wszystko inne stoi na tym, że nightly faktycznie się wykonuje).
5. Reszta Priorytetu 2/3 + "Graf wiedzy" — przy najbliższym dotknięciu odpowiednich funkcji.
6. "Uczciwość danych" + "Ludzie i świat zewnętrzny" — kandydaci na okresy niższego tempa.

---

# Część III — Bugi i dług techniczny

> Zebrane z audytu 2026-07-05. Checklist, nie plan.

## 🟠 Priorytet 2 — write-orphany (dobuduj zapis albo usuń martwy odczyt)

- [x] `endmyopia_daily_logs` — czyta `VisionJournal.tsx`, zero writera.
- [ ] `user_fundament` — `IdentityVault.handleSave()` woła `ingest-vault-log`, niepotwierdzone czy zapisuje tabelę.
- [ ] `nutrition_profile` — 8 miejsc czyta, zero insert/update/upsert.
- [ ] `location_history` — czyta `exportStats.ts`, zero writera.
- [ ] `medical_documents`, `medical_lab_results` — tylko jednorazowy seed, brak ścieżki dodania nowych wyników.
- [ ] `training_plan_workouts` — brak ścieżki edycji planu.
- [ ] `user_portions` — RLS gotowe pod zapis LLM, zero insert/update wywołania.
- [x] `morning_briefs` — całkowicie martwa.
- [ ] `vanguard_entity_aliases` — martwa, porzucony resolwer encji (patrz Część II §4.6 — sprawdź przed budową nowej tabeli encji).

## 🟡 Priorytet 3 — ominięte kanoniczne helpery

- [ ] `todo_items` — surowe zapisy poza `lib/todo.ts`: `checkpoints.ts:85`, `projects.ts:119-183` (3 miejsca), `GrowthView.tsx:233`, `MorningPlanModal.tsx:396-397`, + 3 edge functions (`vanguard-telegram`, `vanguard-push-reminder`, `vanguard-todo-classify`).
- [ ] `kpi_entries` — `Projects.tsx:386-391` omija RPC `increment_kpi_entry_for_week`; `KpiTrendSparkline.tsx:76-90` fallback liczy `+1` z lokalnego stanu.

## 🟢 Priorytet 4 — duplikaty logiki daty/timezone

- [ ] `useGrowthData.ts:281` — `todayStr = weekStart` (mylące), psuje liczenie "dni po terminie" przy oglądaniu innego tygodnia.
- [ ] `fitnessScore.ts:307` — niska pewność, wymaga doczytania.
- [ ] `LeniePanelMini.tsx:20` — poprawna logika, tylko zduplikowana (code smell, nieszkodliwe).

## ⚪ Priorytet 6 — inne, mniej pilne

- [ ] Test coverage edge functions: 4 pliki testowe na ~30 funkcji.
- [ ] CI łapie dryf migracji DB, ale nie dryf **wdrożonego kodu funkcji** vs repo.
- [ ] `as any` w `src/` — patrz Część IV §PD1/§PD2 dla aktualnego stanu i planu.
- [ ] Offline queue: `dreamsApi.ts`, `calendarApi.ts`, `kpiTrendApi.ts` mają zero pokrycia offline.
- [ ] Architektura `task_1..task_5`/`done_1..done_5` w `daily_wins` — sztywne sloty (świadomość, nie ruszać bez wyraźnej potrzeby).

---

# Część IV — Frontend: dług strukturalny

> **Stan bazowy (11.07.2026):** S0-S14 zamknięte. DS0/DS2/DS3/DS5 zamknięte; DS1 i DS4 częściowe. Spłata długu P1-P4 zamknięta (`fixed inset-0` 18→11, `session` prop 44→28, `as any` 119→59, `maxWarnings` 659→496). P5 4/5 zrobione. P6 (~111 mniejszych god-files) — nie zaczęte.

## P0 — Backend krytyczne (blokery, rób pierwsze)

### P0.1 — Nightly gubi wzorce co noc (~30 min)

`_shared/nightly/patterns.ts:47` zwraca `status: "hypothesis"` — CHECK constraint na `vanguard_behavioral_patterns.status` dopuszcza tylko `pending/visible/user_confirmed/user_rejected/snoozed/archived`, insert cicho pada (`upsertPattern()` robi `console.error` i mimo to zwraca sukces).

- [x] Zmień `"hypothesis"` → `"pending"` w `patterns.ts:47`, sprawdź resztę modułu (`grep hypothesis`).
- [x] Deploy + weryfikacja: `SELECT count(*) FROM vanguard_behavioral_patterns WHERE status = 'pending'` przed/po następnym cronie — licznik musi rosnąć.

### P0.2 — Brak walidacji tokenu na `verify_jwt=false` endpointach (~1h)

`vanguard-nightly` i `vanguard-telegram-worker` mają `verify_jwt=false` i zero weryfikacji `Authorization`. Wzorzec poprawnej walidacji już istnieje w `vanguard-backtester`.

- [x] Skopiuj wzorzec do obu funkcji.
- [x] Sprawdź `cron.job.command` — jeśli service-role secret leży plaintextem, przenieś do Supabase Vault.
- [x] Potwierdź że SECURITY DEFINER RPC (`get_desktop_dashboard_data` i inne wykonywalne przez `anon`) też objęte.

### P0.3 — Cotygodniowy `vanguard_graph_cleanup()` niszczy claims (~1-2h)

Trigger `tr_sync_entity_links_to_claims` przy DELETE z merge encji kasuje claims — sprzeczne z warstwą bi-temporalną (§4.5). `merged_into` (nowszy mechanizm) ma 0 użyć.

- [x] Przeczytaj `vanguard_graph_cleanup()` i `tr_sync_entity_links_to_claims`.
- [x] Zdecyduj: wyłącz stary trigram-merge na rzecz `merged_into`, albo soft-delete/re-parenting zamiast kaskadowego kasowania.
- [x] Backfill `entity_aliases` jeśli `merged_into` ma to zastąpić.

### P0.4 — Weryfikacja Fazy 4 (predykcje/rekomendacje) (~15 min)

- [x] `SELECT count(*) FROM vanguard_predictions, oracle_recommendations, vanguard_pipeline_runs` — jeśli 0, debug przed zamknięciem tematu.

## PD — Polish Debt: spłata liczników strukturalnych

Zasada: jedna sesja = jedna kategoria = jeden commit, pełny zielony zestaw (`npm run typecheck:ui && npx eslint <dotknięte> && npm run test && npm run ratchet:frontend`) przed commitem, baseline w `scripts/ops/ratchet-baseline.json`/`legacy-lines-baseline.json` obniżony **w tym samym commicie**.

### PD1 — `as any`: top offenderzy (~2h)

Stan 2026-07-11 po P1-P4 (`as any` 119→59 ogółem; liczby z tabeli poniżej to stan wyjściowy audytu — zweryfikuj aktualne przed sesją):

| Plik | Ile `as any` (audyt) |
|---|---|
| `src/lib/stats/exportStats.ts` | 60 |
| `src/components/lifestyle/direction/hooks/useDirection.ts` | 10 |
| `src/lib/offlineQueue.ts` | 4 |
| `src/lib/health/foodLogging.ts` | 3 |
| `src/lib/aiContext.ts` | 3 |
| `src/components/projects/LifeGoalsCard.tsx` | 3 |
| `src/components/lifestyle/usePowerListData.ts` | 3 |

- [ ] `exportStats.ts` — sprawdź czy to jeden powtarzalny wzorzec, jeden typed helper zamiast castów osobno.
- [ ] Reszta: doprecyzuj typ lub `unknown` + type-guard.
- [ ] Jeśli powodem jest `database.types.ts` nieaktualny wobec schematu — `npm run db:update-types` najpierw.

Wzorce sprawdzone bezpieczne: `catch (e: any)` → `catch (e: unknown)` + `e instanceof Error`; `(x as any).pole` po narrowing zwykle zbędny; `Promise<any>` → `Promise<unknown>`.

### PD2 — `as any`: reszta

- [ ] Pozostałe pliki z 1-2 wystąpieniami (`grep -rln "as any" src` po PD1 daje aktualną listę).
- [ ] Priorytet: pliki dotykane i tak w innych sesjach.

**Target:** 0. `patternCount_asAny` w baseline = 0.

### PD3 — `fixed inset-0`: reszta po DS1

- [ ] `grep -rl "fixed inset-0" src/components | grep -v "ui/Modal.tsx\|ui/ConfirmDialog.tsx"` — powinno być 0-1.

### PD4/PD5 — God-files: fale 1 i 2

Metoda: `docs/FRONTEND_GUIDE.md` §9 "Folder jako moduł" (Wzorzec A). Zawsze: przeczytaj cały plik przed splitem, weryfikacja wizualna przed/po, obniż `legacy-lines-baseline.json` w tym samym commicie.

Fala 2 (po PD4): `exportStats.ts`, `usePowerListData.ts` (745 linii), `ProjectCard.tsx` (613), `GrowthView.tsx` (605), `useDirectionContext.ts` (605 — sprawdź `useGoalSpineInvalidation` deps przed podziałem, patrz `lessons.md` 2026-06-29 nieskończona pętla przy złych deps).

### PD6 — `maxWarnings`: zejście (powtarzalne co sesję)

- [ ] `npx eslint . -f json` → zsumuj warnings per `ruleId`, napraw jedną regułę naraz.
- [ ] Po każdej naprawionej regule: obniż `--max-warnings=N` w `package.json` **i** `maxWarnings` w baseline.
- [ ] Nie więcej niż 1-2 reguły na sesję.

**Target:** 496 (stan po P1-P4) → w dół, minimum -100/sesję.

## P5 — Rozbicie 5 największych god-files (4/5 zrobione)

| # | Plik | Stan |
|---|---|---|
| 1 | `MorningPlanModal.tsx` | ✅ zrobione |
| 2 | `CalendarGrid.tsx` | ✅ zrobione |
| 3 | `LinksInbox.tsx` | ✅ zrobione |
| 4 | `TodoCard.tsx` | ✅ zrobione |
| 5 | `RichEditor.tsx` (855 linii) | **świadomie NIE dzielić** — gęsto powiązana logika DOM (`getSelection`/`Range`/`execCommand`); jedyne bezpieczne wydzielenie: `SLASH_COMMANDS` → osobny plik |

## P6 — Reszta `LEGACY_FILES` (~111 plików, nie zaczęte)

**Odkrycie do zrobienia najpierw (~15 min, zero ryzyka):** sprawdź ile wpisów na liście `LEGACY_FILES`/`legacy-lines-baseline.json` jest już dziś pod limitem 300 linii — usuń je z obu list bez dotykania kodu.

**Klasyfikacja mechaniczna:**

```bash
grep -c "return (" plik.tsx                                    # 0 = czysta logika, nie widok
grep -c "useState\|useReducer" plik.tsx                        # liczba stanów
grep -cE "onTouch|onDrag|execCommand|getSelection|onPointerDown" plik.tsx  # gesty/DOM = czerwona flaga
```

| Tier | Kryterium | Batch | Wymaga planu |
|---|---|---|---|
| 1 | 300-400 linii, ≤4 `useState`, 0 gesty/DOM | do 3 plików/commit | nie |
| 2 | 400-600 LUB (300-400 z >4 `useState`) | 1 plik/commit | nie, ale pełna weryfikacja |
| 3 | 600+ LUB jakiekolwiek gesty/DOM | 1 plik/commit | **tak** + weryfikacja wizualna |

**Twardy checklist dla KAŻDEGO pliku, każdy tier:**
1. Przed edycją: `grep -c "notify(\|console\.warn(\|console\.error(" plik` — zapisz liczbę. Po rozbiciu suma we WSZYSTKICH nowych plikach musi być ≥ oryginalnej.
2. Po przeniesieniu: sprawdź `eslint.config.js` (`LEGACY_FILES`, `NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS`) i `legacy-lines-baseline.json` — nie śledzą `git mv` same.
3. Weryfikacja w kolejności: `typecheck:ui` → `eslint <dotknięte>` → `test` → `ratchet:frontend`, napraw przed kolejnym plikiem.
4. Tier 2/3: sprawdź że żaden `useState`/`useEffect` nie został zduplikowany między starym a nowym miejscem.
5. Nie dotykaj `RichEditor.tsx`, `database.types.ts`. Zero zmian zachowania — bugi zauważone po drodze notuj osobno.

**Kadencja:** po każdym Tier 3 — stop, zgłoś. Po każdych 5 plikach Tier 1/2 — krótkie podsumowanie, jedź dalej.

## DS1/DS4 — reszta Design System (częściowe)

**DS1 (modale/spinnery/empty states) — zostało (stan 2026-07-11):**
- **9 plików** z ręcznym `fixed inset-0`: `DailyShutdownModal.tsx`, `DashboardFastCapture.tsx`, `MorningPlanModal.tsx` (backdrop wizarda), `FoodEntryModal.tsx`, `SearchModal.tsx`, `InsightCard.tsx`, `EndMyopiaCalculator.tsx`, `ActionCenterSheet.tsx`, `WeeklyReviewModal.tsx`. Migruj proste header+content na `ui/Modal`.
- **30 plików** z `border-dashed` poza `ui/EmptyState.tsx`/`todo/EmptyState.tsx`.

**DS4 (audyt responsywności) — zostało:** Desktop (`/dashboard`), Growth do końca, Medical, Settings, Tydzień, Historia. Dla każdego na 375px i 1280px: horizontal overflow, console errors (0 tolerowane), touch targets <44px, sidebar na mobile.

**DS6 (adopcja ciągła)** — zasada skauta: dotykasz pliku z inline overlay/empty state/hardkodem koloru → przy okazji przepnij na wspólny komponent/token.

---

# Część VI — Capacitor Android (APK)

> PWA na Vercel zostaje PWA. APK = ten sam `src/` + shell w `android/`. SSOT sesji: `docs/agent/ACTIVE_WORK.md`.

- [x] **Faza 1 — bootstrap:** Capacitor + `mobile:*` scripts + `isNativePlatform` (2026-07-21)
- [ ] **Faza 2 — FCM push:** token w DB + dual-send w `vanguard-push-reminder` (Web Push PWA + FCM APK)
- [ ] **Faza 3 — Usage Stats → `phone_usage_daily`:** live ingest zamiast ręcznego AW phone import
- [ ] **Faza 4 — lokalizacja:** foreground context → opcjonalnie background

---

# Część V — Resolution Layer / Partner Mode

> Hard Freeze na `vanguard-auto-classify` i kod produkcyjny zdjęty 2026-07-10.

## Cel

Telegram ma przestać być pasywnym Loggerem i stać się Partnerem: przed odpowiedzią bot sprawdza graf faktów (`public.claims`) i stan biometryczny (Oura).

Warunek konieczny: graf encji (`entities`/`entity_aliases`/`claims`) musi być spójny — jedna realna rzecz = jedna encja. Dziś tak nie jest.

## Diagnoza (zweryfikowana bezpośrednio w bazie)

- `entities`: 232 wiersze, wszystkie utworzone 2026-07-08.
- `entity_aliases`: **0 wierszy.** Trigger `tr_new_entity_alias` istnieje, ale 232 encje powstały zanim/bez tego by trigger je zasilił — Tier 1 (trigram) nie ma dziś na czym trafić.
- Duplikaty potwierdzone (zgodność `kind` + wysokie podobieństwo): `Cyberbezpieczenstwo`/`Cyberbezpieczeństwo` — sim 0.74; `Kinga`/`Kuzynka Kinga` — sim 0.46.
- Fałszywe alarmy odrzucone po sprawdzeniu `kind` (NIE scalać): `Analiza`/`Analiza Danych`/`Analityk Danych` — trzy różne pojęcia; `Siłownia` (place) vs `siłownia_jutro`/`siłownia_w_sobotę`/`siłownia_w_niedzielę` (event) — miejsce vs wydarzenia.

## Otwarte zadania

- [ ] Backfill `entity_aliases` dla istniejących 232 encji.
- [ ] Ręczny merge: Kinga/Kuzynka Kinga, Cyberbezpieczenstwo/Cyberbezpieczeństwo.
- [ ] Dodać krok B2 (fuzzy match + kind guardrail + confidence gap) do `resolve_entity()` + indeks GIN na `entity_aliases.alias`.
- [ ] Podłączyć `fetchWorldState()` w `queryOracle` zamiast ręcznego `Promise.all`.
- [ ] Dodać Resolution Layer (Tier 1 trigram / Tier 2 embedding+LLM) + odczyt `public.claims` do `queryOracle`.
- [ ] Deploy `vanguard-telegram` po weryfikacji powyższego.
