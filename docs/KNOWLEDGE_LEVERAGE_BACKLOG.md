# Vanguard OS — Knowledge Layer & Leverage Points Backlog

> Zebrane z sesji audytowej 2026-07-07. Ten dokument jest samodzielny — pisany tak, żeby agent AI widzący ten kod pierwszy raz wiedział dokładnie co robić, bez potrzeby czytania czatu, z którego powstał.
>
> **Nie duplikuje:** `docs/BUG_TECH_DEBT_BACKLOG.md` (bugi/silent-fail/write-orphany), `docs/PRODUCTIVITY_BACKLOG.md` (feature backlog z innych appek), ani głównej "Master listy" z audytu 2026-07 (Partie 0-4, punkty 1-56 — commity, backup, ESLint, router itd.). Ten dokument to inna warstwa: **czy system, który już zbiera dane o Jakubie, faktycznie wie to co zbiera, i czy się z tego rozlicza.**
>
> Wspólny wzorzec każdej pozycji: **zero nowego codziennego inputu od Jakuba.** Każda pozycja to złączenie/domknięcie klocków, które już istnieją w kodzie — nie nowy moduł do obsługi. Jeśli realizujesz którąś pozycję i odkryjesz, że wymaga ona codziennego ręcznego wpisywania czegoś przez Jakuba — to jest sygnał, że coś zaprojektowano źle (patrz `feedback_no_maintenance_features` w pamięci agenta: zero-maintenance features only).

---

## Kontekst systemu (przeczytaj, zanim zaczniesz)

Vanguard to prywatny life-OS Jakuba: React SPA (`src/`) + Supabase (Postgres + Auth + Edge Functions Deno, `supabase/functions/`). Pełna architektura: [docs/ARCHITECTURE.md](ARCHITECTURE.md). Kanoniczny flow wiedzy:

```
Telegram / voice / manual ingest
        │
        ▼
  vanguard_stream          ← surowa ewidencja użytkownika (source of truth)
        │
        ├──► vanguard-auto-classify  → friction_events (jedyny pipeline tarcia)
        ├──► vanguard-architect (batch) → vanguard_entity_links (graf wiedzy — triady: source_entity → relation → target_entity)
        ├──► vanguard-wiki-compiler → vanguard_wiki_pages (skompilowana pamięć, derived)
        └──► ingest-vault-log (long-form) → stream chunks + graf RPC

READ path: Oracle (supabase/functions/vanguard-oracle) czyta graf + wiki + world_state + stream
Nightly (supabase/functions/vanguard-nightly): agreguje dzień, liczy strain/illness/recovery, wykrywa patterny, liczy korelacje
```

Kluczowe tabele do zapamiętania (pełna lista w ARCHITECTURE.md):
- `vanguard_entity_links` — graf wiedzy, triady z `confidence_score`, `status` (active/historical), `superseded_by`
- `vanguard_wiki_pages` — skompilowana pamięć (derived, nie source-of-truth), ma `source_refs`
- `vanguard_wiki_review_items` — kolejka słabych/konfliktowych twierdzeń wiki do przeglądu przez człowieka
- `oracle_clarification_requests` — pytania Oracle do Jakuba (system wzięty z Memex, opisany niżej)
- `vanguard_daily_aggregates` — dzienny snapshot biometrii/wykonania
- `vanguard_behavioral_patterns` + `pattern_events` — wykryte wzorce behawioralne + ich wystąpienia
- `vanguard_oracle_runs` — audit log Oracle (read-only telemetria)
- `behavior_log` — confoundery: alkohol, stres, choroba, podróż

**Konstytucyjna zasada, którą każda pozycja musi respektować** (z `docs/ARCHITECTURE.md`, sekcja "What we do not build"): Oracle NIE zapisuje do grafu/wiedzy automatycznie w każdej turze rozmowy — to było celowo wyłączone w Sprint 0.7 (2026-05-17, patrz `docs/TECHNICAL.md:512`), bo LLM mutował source-of-truth bez weryfikacji. Każda propozycja poniżej, która dotyczy zapisu do grafu, MUSI przechodzić przez bramkę potwierdzenia człowieka (patrz sekcja "ClarificationRequest" niżej) — nigdy bezpośredni zapis z odpowiedzi czatu.

---

## 🥇 PRIORYTET 1 — najwyższa dźwignia, najniższy koszt, rób w tej kolejności

### 1.1 Write-back `proposed_memory` z ClarificationRequest do grafu wiedzy

**Co to jest ClarificationRequest:** wzorzec przeniesiony z projektu Memex (`C:\Users\jakub\Desktop\REZTA\memex-explore`, patrz `VANGUARD_MEMEX_STEAL.md` #1) i już częściowo wdrożony. Oracle, zamiast zgadywać niepewny fakt, może zadać strukturalne pytanie Jakubowi. System prompt Oracle (`supabase/functions/vanguard-oracle/oracle/systemPrompt.ts:84-109`) generuje pole `clarification_request` gdy confidence < 0.7 dla trwałego faktu. Zapis: `supabase/functions/vanguard-oracle/oracle/mutations.ts:29-50` (`saveClarificationRequest`) — insertuje do tabeli `oracle_clarification_requests` z polami: `question`, `response_type`, `options`, `dedupe_key`, `evidence_fact_ids`, `proposed_memory`, `confidence`, `status: 'pending'`.

UI istnieje w dwóch miejscach: `src/components/ai/ClarificationRequestCard.tsx` i wpięcie w `src/components/ai/OracleCard.tsx` (linie ~104-236) oraz `src/components/shared/ActionCenterSheet.tsx`.

**Problem — sprawdzone w kodzie:** `ClarificationRequestCard.tsx:65` po odpowiedzi Jakuba robi TYLKO:
```
.update({ status: 'answered', answer: answer as any, answered_at: new Date().toISOString() })
```
`proposed_memory` — czyli konkretny fakt, który Oracle chciał zapamiętać i który Jakub właśnie POTWIERDZIŁ osobiście — **nie ląduje nigdzie jako trwały fakt**. Jedyny efekt jest w `supabase/functions/vanguard-oracle/oracle/rag.ts:599-603`: odpowiedzi na wcześniejsze pytania są wstrzykiwane z powrotem jako blok tekstu do promptu następnej rozmowy (`clarificationsContext`). To znaczy: fakt potwierdzony przez człowieka jest przechowywany jako **kontekst czatu**, a nie jako **twierdzenie w grafie wiedzy**. Po kilku tygodniach ten kontekst wypadnie z okna (jest przycinany), a fakt zniknie.

**Dlaczego to jest najwyższa dźwignia w całym audycie:** to jest dokładnie ta bramka "human confirmation przed zapisem do grafu", której zabrakło przy amputacji z Sprint 0.7. Nie trzeba jej projektować od zera — istnieje, tylko ostatni drut nie jest podłączony.

**Co zbudować:**
1. W `ClarificationRequestCard.tsx` (albo w nowym Supabase trigger/edge function, decyzja implementacyjna) — po `status: 'answered'` i **tylko gdy odpowiedź faktycznie potwierdza** `proposed_memory` (nie "nie jestem pewny" / nie custom-answer sprzeczna z propozycją): insert do `vanguard_entity_links` z:
   - `source_entity` / `target_entity` / `relation` sparsowane z `proposed_memory` (albo: dodać do systemPrompt Oracle wymóg, żeby `clarification_request` zawierał już gotową triadę `proposed_triad: {source, relation, target}` obok `proposed_memory` jako tekstu — łatwiejsze niż parsować tekst)
   - `confidence_score: 0.95` (wysoka, bo potwierdzone przez człowieka, nie odgadnięte)
   - `status: 'active'`
   - metadane provenance: skąd ten fakt pochodzi (np. pole `source: 'user_confirmed_clarification'` albo w `metadata` JSON) — żeby dało się go odróżnić od faktów wyekstrahowanych automatycznie przez `vanguard-architect`
   - `learned_at: now()` — patrz punkt 1.5 (bitemporalność) niżej; jeśli ta kolumna jeszcze nie istnieje, dodać ją przy okazji tej migracji, bo to pierwszy zapis który jej potrzebuje
2. Jeśli triada koliduje z istniejącym aktywnym faktem (ten sam `source_entity`+`relation`), oznaczyć stary jako `superseded` — użyć istniejącego mechanizmu z `supabase/functions/_shared/deprecateSupersededLinks.ts` (już używanego przez `vanguard-architect`).
3. Test: odpowiedz na jedno pytanie Oracle w UI, sprawdź czy nowy wiersz pojawia się w `vanguard_entity_links` z poprawnym confidence i statusem.

**Szacowany koszt:** ~1 wieczór — jeden nowy insert, reużycie istniejącego mechanizmu supersede.

---

### 1.2 Kalibracja prognoz — metryka nadrzędna dla całej reszty audytu

**Kontekst:** scope-gates na predykcje w konstytucji projektu zostały świadomie uchylone 2026-07-02 (patrz pamięć agenta `feedback_constitution_scope_lifted`: "coach mode/predykcje/gamifikacja/auto-scheduling dozwolone"). Od tego czasu **nic z tego nie zostało zbudowane** — sprawdzone: brak jakiejkolwiek tabeli/kolumny `predicted_*` w `database.types.ts` powiązanej z prognozą dnia następnego.

**Problem:** system twierdzi (przez Oracle, przez wiki, przez patterns), że "rozumie" Jakuba, ale nie ma żadnego mechanizmu, który by to zweryfikował. Nie wiadomo, czy self-model faktycznie coś przewiduje, czy tylko ładnie opowiada po fakcie (co jest dużo łatwiejsze dla LLM niż realna predykcja).

**Co zbudować:**
1. Nowa tabela, np. `vanguard_daily_predictions`: `user_id`, `date` (dzień którego dotyczy predykcja), `predicted_at` (kiedy prognoza powstała — musi być PRZED dniem którego dotyczy), `metric` (np. `sleep_hours`, `readiness_score`, `execution_score`), `predicted_value`, `predicted_interval_low`, `predicted_interval_high`, `actual_value` (uzupełniane następnego dnia), `error` (obliczone).
2. Krok w `vanguard-nightly` (plik `supabase/functions/vanguard-nightly/index.ts`, dodać jako kolejny krok w istniejącej sekwencji kroków 1-8): na podstawie ostatnich N dni + world_state wygeneruj predykcję na jutro dla 2-3 kluczowych metryk (sleep_hours, readiness_score, execution_score — te już są w `WorldState` interface w `supabase/functions/_shared/worldState.ts`). Prosty model wystarczy na start (np. średnia ważona ostatnich 7 dni + trend), LLM nie jest tu konieczny.
3. Krok następnego dnia (albo w tym samym nightly run, patrząc wstecz o 1 dzień): uzupełnij `actual_value` z `vanguard_daily_aggregates`/`oura_daily_summary` i policz błąd.
4. Po miesiącu danych: dashboard/panel liczący Brier score lub prosty MAE trend w czasie. Malejący błąd = self-model faktycznie się uczy. Płaski/rosnący = sygnał którego brakuje w reszcie audytu (patrz "Zasada zamykająca" na końcu dokumentu).

**Dlaczego to jest priorytet, nie ciekawostka:** to jedyny obiektywny sposób, żeby zdecydować, CZY dokładać nowe źródła danych (pogoda, cykliczność, itd. — sekcja "Uczciwość danych" niżej) — dokładasz sensor dopiero gdy krzywa kalibracji się wypłaszcza, nie na zapas.

---

### 1.3 Pompa active learning: `vanguard_wiki_review_items` → `oracle_clarification_requests`

**Kontekst:** `vanguard-wiki-compiler` (`supabase/functions/vanguard-wiki-compiler/index.ts`) już generuje `ReviewDraft` (typ zdefiniowany w tym pliku, linie 26-35) — czyli wpisy do kolejki słabych/stale/konfliktowych twierdzeń wiki, z polami `item_type`, `title`, `detail`, `severity`, `source_refs`. Zapisuje je do `vanguard_wiki_review_items`.

**Problem:** ta kolejka istnieje i jest zapełniana, ale nic jej **nie konsumuje**. Jednocześnie `vanguard-eval-interview` (cron `0 10 * * 1-5`, patrz ARCHITECTURE.md) zadaje w południe pytanie refleksyjne — ale **generyczne**, nie oparte na tym co system faktycznie nie wie / czego jest niepewny.

**Co zbudować:**
1. W `vanguard-eval-interview` (`supabase/functions/vanguard-eval-interview/index.ts`) albo jako nowy krok w nightly: zamiast (lub obok) generycznego pytania, zapytaj:
   - `vanguard_wiki_review_items` posortowane po `severity` — weź top 1-2 nieprzejrzane
   - `vanguard_entity_links` z najstarszym `created_at` wśród `status='active'` i `confidence_score < 0.7` (najbardziej "przeterminowana niepewność")
2. Dla wybranej pozycji wygeneruj `oracle_clarification_request` (ten sam insert co robi Oracle w `mutations.ts` — reużyj funkcję `saveClarificationRequest` albo analogiczną), z `dedupe_key` zapobiegającym duplikatom.
3. Odpowiedź Jakuba przechodzi tą samą ścieżką co punkt 1.1 (write-back do grafu) — więc **musisz zrobić 1.1 przed tym punktem**, inaczej odpowiedzi znowu wpadną tylko do kontekstu czatu.
4. Rezultat: pełny obieg — system wykrywa własną niepewność (wiki-compiler) → pyta (eval-interview/clarification) → Jakub potwierdza (UI istniejące) → wiedza rośnie z provenance (write-back z 1.1).

---

## 🥈 PRIORYTET 2 — domyka pętle rozliczenia (system produkuje, ale się nie sprawdza)

### 2.1 Rada Oracle'a jako obiekt, nie gaz

**Problem:** system prompt Oracle (`systemPrompt.ts:93`) definiuje typ odpowiedzi `"fact | hypothesis | recommendation"` — Oracle wydaje rekomendacje. Ale żadna rekomendacja nie jest reprezentowana jako obiekt z warunkiem, metryką sukcesu i oknem ewaluacji. `vanguard_oracle_runs` (zapis w `mutations.ts:3-27`, funkcja `logOracleRun`) to tylko **telemetria read-only** — loguje że rozmowa się odbyła, nie czy rada zadziałała.

**Co zbudować:**
1. Nowa tabela `oracle_recommendations`: `id`, `oracle_run_id` (FK do `vanguard_oracle_runs`), `recommendation_text`, `related_metric` (np. `sleep_hours`, `execution_score` — z katalogu w `supabase/functions/_shared/correlationCatalog.ts`), `success_threshold`, `evaluation_window_days`, `status` (`pending`/`evaluated`), `outcome` (uzupełniane później).
2. Gdy Oracle emituje `type: "recommendation"`, zapisz ją do tej tabeli (rozszerz `logOracleRun` albo dodaj nową funkcję w `mutations.ts`).
3. Auto-ewaluacja: skopiuj wzorzec z `supabase/functions/_shared/nightly/outcomes.ts` (funkcja `runPatternOutcomes`) — ten sam windowed join (N dni po zdarzeniu, sprawdź czy metryka się poprawiła), tylko zamiast `pattern_events` źródłem jest `oracle_recommendations`.
4. Dodaj krok wywołujący tę ewaluację do `vanguard-nightly/index.ts`, analogicznie do istniejącego kroku 5 (`runPatternOutcomes`).

### 2.2 `vanguard-backtester` — katalog jest pusty

**Sprawdzone bezpośrednio:** `find C:/Users/jakub/Desktop/Vanguard/supabase/functions/vanguard-backtester -type f` zwraca **zero plików**. Pozycja #28 z głównej Master listy audytu ("Backtest odpalić po deployu i ocenić rady historyczne") wskazuje na funkcję, której **w repozytorium nie ma ani linijki kodu źródłowego**.

**Co zrobić — w tej kolejności:**
1. Sprawdź przez Supabase (`list_edge_functions` / dashboard), czy `vanguard-backtester` jest wdrożony na serwerze produkcyjnym mimo braku źródła w repo. To jest **druga instancja** tej samej klasy problemu co dzisiejsze znalezisko z `vanguard-nightly` (heartbeat testuje `compute-daily-strain`, funkcję bez źródła w repo, bo konsolidacja do nightly usunęła stare funkcje z repo, ale prawdopodobnie nie z serwera) — może to być spójny wzorzec "cutover zrobiony w złej kolejności" w całym projekcie, nie tylko w nightly. Warto zrobić pełny audit: `list_edge_functions` przez Supabase MCP vs zawartość `supabase/functions/` w repo, znaleźć WSZYSTKIE rozbieżności naraz.
2. Jeśli funkcja istnieje na serwerze: pobrać jej kod (jeśli możliwe) zamiast pisać od zera, żeby nie stracić ewentualnej logiki.
3. Jeśli nie istnieje nigdzie: napisać od zera, ale DOPIERO PO punkcie 2.1 (rady jako obiekt) i punkcie 1.5/bitemporalność niżej — inaczej backtester nie ma czego oceniać (nie ma tabeli rad) i będzie oceniał nieuczciwie (przeciek przyszłej wiedzy do przeszłości).

### 2.3 Nightly nie ma księgi przebiegów (ledger)

**Sprawdzone w kodzie:** `supabase/functions/vanguard-nightly/index.ts`, linie 79-89 — każdy krok pipeline'u (`runComputeDailyStrain`, `runComputeIllnessSignal`, `runComputeRecoveryForecast`, `runDetectPatterns`, `runPatternOutcomes`) jest owinięty w `.catch(e => console.error(e))` i pipeline leci dalej. Jeśli krok 3 (compute-daily-strain) padnie, kroki 4-9 liczą dalej **na nieaktualnych/brakujących danych**, a `world_state` na końcu wygląda na świeży (bo `fetchWorldState`/`saveWorldState` z `worldState.ts` nie wie, że dane pod spodem są półproduktem).

**Co zbudować:**
1. Nowa tabela `vanguard_pipeline_runs`: `run_id` (uuid, jeden per wywołanie nightly), `step_name`, `status` (`ok`/`error`/`skipped`), `started_at`, `finished_at`, `error_message` (nullable).
2. W `vanguard-nightly/index.ts` — zamiast gołego `.catch(console.error)`, opakuj każdy krok helperem, który zapisuje wpis do `vanguard_pipeline_runs` przed i po (albo po z timing).
3. Heartbeat (istniejący mechanizm monitoringu, patrz Master lista punkt #14 "Heartbeat → Telegram przy failu") powinien czytać **ten ledger**, nie testować bezpośrednio funkcje HTTP (co dziś daje fałszywy zielony status nawet gdy logika wewnątrz pada — patrz `e2e-daily-loop.mjs:132` testujący `compute-daily-strain` przez OPTIONS request, co nie sprawdza czy funkcja faktycznie coś policzyła).

---

## 🥉 PRIORYTET 3 — model pojemności (dotyczy codziennego planowania)

### 3.1 Zadania nie mają kosztu

**Sprawdzone w `src/lib/database.types.ts`:** tabela `todo_items` nie ma żadnej kolumny effort/energy/duration. Jedyne wystąpienia `duration_minutes` w całej bazie dotyczą treningów (`workout_sessions` i pokrewne, linie ~3458, 5114 w `database.types.ts`), nie zadań.

**Problem:** `src/lib/dailyPlanProposal.ts` (deterministyczne składanie planu dnia z checkpointów/pinów/KPI/sprintu, funkcje `defaultPillarProject`, `suggestDailyKpiTarget`) widzi `readinessScore`/`recoveryScore` w `DirectionContextData` (linie 64-65 tego pliku), ale **nie ma czym tego wykorzystać** — zadania nie deklarują ile kosztują, więc plan nie umie powiedzieć "dziś recovery 40, zmieść 2 ciężkie zadania zamiast 5". Sygnał `planAdherence` istnieje osobno w `supabase/functions/_shared/vanguardPatterns/planAdherence.ts`, ale nic nie karmi nim rozmiaru propozycji dnia.

**Co zbudować:**
1. Migracja: dodaj kolumnę `estimated_effort` (skala 1-5 albo enum `light`/`medium`/`heavy`) do `todo_items`.
2. LLM już przetwarza każde nowe zadanie przy capture — funkcje `vanguard-todo-extract` i `vanguard-todo-classify` (`supabase/functions/vanguard-todo-extract/`, `supabase/functions/vanguard-todo-classify/`). Dodaj jedno pole do istniejącego promptu klasyfikującego, żeby LLM oszacował effort przy okazji (nie osobne wywołanie).
3. `dailyPlanProposal.ts` — dodaj logikę: sumuj effort proponowanych zadań, porównaj z pojemnością dnia wyliczoną z `readinessScore`/`recoveryScore` (prosta funkcja liniowa na start), przytnij propozycję jeśli przekracza.
4. Kalibracja pojemności: użyj `planAdherence.ts` — historia "ile planowano vs ile wykonano" powinna z czasem korygować mnożnik pojemności per poziom recovery (uczenie się realnej wydolności Jakuba, nie zgadywanie).

### 3.2 `useAIScheduling` to hardkodowany bin-packer

**Sprawdzone w `src/hooks/useAIScheduling.ts`:** funkcja `handleAISchedule` (linie 35+) pakuje zadania w wolne interwały kalendarza, ale "Focus Time Defense" to zahardkodowany blok 8:00-10:00 (linie 50-60, sprawdzenie `i.start < 600 && i.end > 480` w minutach), niezależny od jakichkolwiek danych o Jakubie. Nie odczytuje `world_state`, recovery, ani (przed realizacją 3.1) efortu zadań.

**Co zbudować:** po zrobieniu 3.1, podłącz ten sam model pojemności do `useAIScheduling` — zamiast pakować zadania w kolejności z inboxu, sortuj/dobieraj wg effort vs pora dnia vs recovery. To naprawia jednym prymitywem trzy rzeczy naraz: planner (3.1), scheduling (ten punkt), i pozycję #51 z głównej Master listy audytu ("nightly pisze bloki kalendarza — recovery, deep work pod checkpoint" — bo dopiero z modelem pojemności nightly ma na czym oprzeć decyzję co i kiedy wstawić).

---

## Graf wiedzy — pozycje strukturalne

### 4.1 Warstwa `claims` jako nadrzędna nad graf/wiki/fundament

**Problem — sprawdzone w kodzie:** dziś istnieje pięć niezależnych magazynów wiedzy o Jakubie, każdy z własną semantyką:
- `vanguard_entity_links` — triady z `confidence_score`
- `vanguard_wiki_pages` — kompilat (derived, ma `source_refs`)
- `user_fundament` — statyczna tożsamość (`identity`, `philosophy`, `vision`, czytane w `rag.ts:101-104`)
- `vanguard_preferences` — osobna tabela preferencji (czytana `rag.ts:105-108`)
- Beliefs z `vanguard-metabolism` — **hack**: `supabase/functions/vanguard-metabolism/index.ts:65-77` wrzuca skondensowany paragraf narracyjny jako triadę do `vanguard_entity_links` z `source_entity: "Kondensacja: {data} - {data}"`, `target_entity: 'Jakub'`, `relation: 'HISTORYCZNY_WRAŻLIWY_PUNKT'` — to nie jest prawdziwa triada podmiot-relacja-obiekt, to string wciśnięty w niepasujący kształt tabeli.

Oracle sklejam wszystkie pięć konkatenacją tekstu w promptcie (`rag.ts`) — nie ma między nimi żadnych referencji ani wspólnego confidence.

**Co zbudować (większa zmiana, rób przy okazji dotykania architekta/wiki-compilera, nie osobną sesją):** jeden kanoniczny obiekt `claim` (treść, typ: `fact`/`hypothesis`/`belief`/`preference`/`correlation`, confidence, `evidence_refs`, ważność w czasie, `learned_at`). Graf staje się indeksem dowodów, wiki projekcją do czytania, `user_fundament` zbiorem twierdzeń zadeklarowanych explicite przez Jakuba (najwyższe zaufanie). Nie trzeba nic wyrzucać z dnia na dzień — to jest kierunek migracji, nie big-bang rewrite.

### 4.2 Korelacje/patterns nie emitują wiedzy do grafu — most nie istnieje w żadną stronę

**Sprawdzone:** `supabase/functions/_shared/correlationCatalog.ts` definiuje ~80 metryk numerycznych (linie 4-80+: sleep_h, hrv, readiness, strain, recovery, calories, protein, steps, screen_time_min, itd.) z etykietami dla silnika korelacji. `vanguard-architect` (`extraction/processor.ts`) ekstrahuje triady z tekstu (stream). **Te dwa światy nigdy się nie widzą.** Odkryta korelacja (np. "późna kofeina → gorszy sleep_efficiency") nigdy nie staje się twierdzeniem, które Oracle może zacytować obok faktów z grafu. Fakt z grafu (np. "Jakub przygotowuje się do maratonu") nigdy nie wpływa na to, które korelacje są aktualnie istotne do podniesienia.

**Co zbudować:** krok w `vanguard-nightly` (po `runComputeCorrelations`, plik `supabase/functions/_shared/nightly/correlations.ts`) — istotne statystycznie korelacje (użyj już istniejącego filtra `isInterestingCorrelation` z `supabase/functions/_shared/correlationInterest.ts`, linia 41+) emitują wpis do tej samej warstwy `claims`/`vanguard_entity_links` co architekt, z `memory_type: 'correlation'` i `relation` typu `koreluje_z`.

### 4.3 `pattern_events` oceniane jedną uniwersalną metryką niezależnie od domeny

**Sprawdzone w `supabase/functions/_shared/nightly/outcomes.ts`:** funkcja `runPatternOutcomes` (cała logika, linie 1-60+) ocenia SUKCES każdego patternu — niezależnie czy dotyczy snu, treningu, jedzenia czy czegokolwiek innego — wyłącznie przez próg `execution_score >= 0.80` (linia 48). Pattern o śnie oceniany metryką wykonania zadań to pomylona kategoria wyniku.

**Co zbudować:** dodaj kolumnę `outcome_metric` do `vanguard_behavioral_patterns` (np. wartość z katalogu `correlationCatalog.ts` — `sleep_h`, `execution_score`, `strain`, itd., ustawiana przy tworzeniu patternu przez `vanguard-analyst` albo `detect-patterns`). W `outcomes.ts` zamień hardkodowane `execution_score` na dynamiczny lookup tej kolumny.

### 4.4 Bug: brak filtra `user_id` w `outcomes.ts`

**Sprawdzone dokładnie — `supabase/functions/_shared/nightly/outcomes.ts:29-33`:**
```ts
const { data: facts } = await supabase
  .from('vanguard_daily_aggregates')
  .select('execution_score')
  .gte('date', startStr)
  .lte('date', endStr);
```
Brak `.eq('user_id', userId)`. Dziś niegroźne (single-user), ale to mina pod wielu-userowy scenariusz albo pod dane testowe w tej samej bazie. **Napraw przy okazji realizacji 4.3** (i tak edytujesz ten plik).

### 4.5 Brak bitemporalności — backtester (kiedy powstanie) będzie oszukiwał

**Sprawdzone:** `vanguard_entity_links` ma `superseded_by` i `status` (`active`/`historical`) — czyli wie **że** fakt się zmienił, ale nie ma rozróżnienia "kiedy to było prawdą" (`valid_at`) vs "kiedy system się o tym dowiedział" (`learned_at`) — klasyczny wzorzec bitemporalny (znany z projektu Graphiti). Skutek: backtester oceniający radę wydaną 15 maja może przez retrieval przypadkowo skorzystać z wiedzy zdobytej w czerwcu — przyszłość przecieka do przeszłości, backtest kłamie.

**To jest ten sam problem klasowo co `algo_version`** (pozycja z głównej Master listy audytu, punkt "Nowe tamy" #1 z pierwszej rundy tej sesji: kolumna `algo_version` na danych pochodnych typu strain/aggregates, żeby backtest nie mieszał wyników liczonych starym i nowym wzorem).

**Co zbudować:** dodaj kolumnę `learned_at` (timestamp, domyślnie `created_at`) do `vanguard_entity_links` — i do nowej tabeli `claims` jeśli/gdy powstanie (4.1). W retrieval używanym przez backtester (gdy powstanie, patrz 2.2), filtruj `learned_at <= as_of_date`. **Zrób to PRZED napisaniem backtestera od zera** (2.2) i **przed pierwszym poważnym uruchomieniem** istniejącego mechanizmu backtestu, razem z `algo_version`.

### 4.6 Graf jest stringowy, nie encyjny — brak tabeli encji

**Sprawdzone w `supabase/functions/vanguard-architect/extraction/processor.ts:44`:** deduplikacja encji to instrukcja w prompcie LLM ("jesli dwie encje sa TYM SAMYM obiektem realnym, uzywaj pelniejszej nazwy") — nie ma żadnej tabeli encji w bazie. `vanguard_entity_links` trzyma `source_entity`/`target_entity` jako gołe stringi.

**Co zbudować:** nowa tabela `vanguard_entities`: `id`, `canonical_name`, `aliases` (text[]), `entity_type` (`person`/`place`/`concept`/`goal`/itd.), `embedding` (dla resolution semantycznego, nie tylko string-match). `vanguard-architect` przy tworzeniu triady najpierw rozwiązuje `source`/`target` do istniejącej encji (fuzzy match po `canonical_name`/`aliases`, opcjonalnie embedding similarity) zamiast tworzyć nowy string za każdym razem. To jest fundament pod:
- Backlink view — pozycja już opisana w `docs/direction/FEATURE_INSPIRATIONS.md:101` ("Klik na encję w wiki → lista wszystkich wpisów/friction/reconciliation jej dotyczących")
- Dossier encji (jedna strona per osoba/miejsce/projekt kompilująca wszystko co graf wie)
- Statystyki stopnia węzła (które encje są najbardziej "centralne" w życiu Jakuba)

Uwaga: `vanguard_entity_aliases` — tabela z tą właśnie nazwą już istnieje w bazie, ale jest **martwa** (opisana jako "porzucona funkcja resolwera encji z grafu wiedzy" w `docs/BUG_TECH_DEBT_BACKLOG.md`, sekcja write-orphany). Sprawdź ją PRZED tworzeniem nowej tabeli — może to już jest ten fundament, tylko nigdy nie dopięty.

### 4.7 Dossier celu — knowledge zorganizowana wokół celów, nie tylko wokół zapytań

**Problem:** retrieval Oracle'a jest query-driven — `rag.ts`, funkcja `classifyIntentSafe` (linie 42-50) klasyfikuje intencję pytania przez regex, `buildGraphSeeds` (linie 29-40) buduje seeds do przeszukania grafu na podstawie aktualnego pytania. System zna cele Jakuba (`life_goals`, sprint goals, checkpointy z projektów) ale nic nie kompiluje wiedzy WOKÓŁ konkretnego celu przekrojowo.

**Co zbudować:** `vanguard-wiki-compiler` (już umie pisać strony typu `page_type`, patrz `WikiPageDraft` w `index.ts:13-24`) — dodaj nowy `page_type: 'goal'`. Dla każdego aktywnego `life_goal` (albo najważniejszego, np. maraton — patrz sekcja "Ludzie i świat zewnętrzny" niżej) kompiluj: relevantne korelacje z katalogu, twierdzenia z grafu dotyczące tego celu (przez encje z 4.6, jeśli już gotowe), eksperymenty (patrz sekcja niżej), checkpointy, trend kluczowej metryki vs gap do celu. To złączenie istniejących danych, nie budowa nowego źródła — nightly już ma wszystko, wiki-compiler już umie pisać.

### 4.8 Tygodniowy diff self-modelu — wiedza widzialna dla człowieka

**Problem:** system zmienia przekonania (supersede w grafie, merge, nowe claims) niewidzialnie. Nie ma nigdzie zapisu "co system zmienił w tym co wie o Jakubie w tym tygodniu".

**Co zbudować:** krok w `vanguard-weekly-synthesis` (`supabase/functions/vanguard-weekly-synthesis/index.ts`) albo nowy: zapytaj `vanguard_entity_links` o wiersze z `created_at`/`superseded_at` w ostatnim tygodniu, zbuduj krótkie podsumowanie ("3 nowe twierdzenia, 1 nadpisane: X→Y, 2 tracą pewność"). To jest gotowy prefill do `WeeklyReviewModal` (pozycja #30 z głównej Master listy audytu, "digest przestaje pisać w próżnię" — dziś ten modal nie ma skąd wziąć treści o zmianach w wiedzy, ten krok mu ją daje).

### 4.9 4 Lenses — leży od dawna, 15 minut roboty

**Sprawdzone w `VANGUARD_MEMEX_STEAL.md:100-115`:** wzorzec z Memex, oznaczony `[WDROŻYĆ — tylko prompt]`, **nadal niewdrożony** (sprawdzone: brak śladu w `supabase/functions` przez grep frazy "Hidden Contexts"/"Energy Tides"). Cztery kąty patrzenia przy analizie danych:
1. Hidden Contexts — co jest tłem/kontekstem, co nie jest oczywiste
2. Energy Tides — kiedy energia/momentum jest wysoka vs niska
3. Micro-Consistency — co jest spójne między małymi zdarzeniami
4. Interactive Curiosity — co warto zbadać głębiej

**Co zbudować:** dodaj te 4 punkty jako instrukcję do system promptu w `supabase/functions/vanguard-analyst/index.ts` (cron `0 3 * * *`) i/lub `vanguard-oracle/oracle/systemPrompt.ts`. Zero nowego kodu poza edycją tekstu promptu.

---

## Uczciwość danych — braki i skażenia próby

### 5.1 Braki danych nie są rozróżnialne od zdarzeń

**Problem:** dzień bez zalogowanego posiłku (`daily_food_entries`) wygląda w danych identycznie jak dzień głodówki. Brak wpisu w `behavior_log` (alkohol, choroba, podróż, stres — te tabele istnieją i są czytane przez katalog korelacji, patrz `correlationCatalog.ts:72-75`) wygląda jak "na pewno nie wystąpiło", a nie "nie wiadomo". Progi `n` w silniku korelacji (widoczne w `correlationInterest.ts:41-50`, `r.n < 5` odrzuca) chronią przed małą próbą, ale nie przed próbą **systematycznie fałszywą** (np. tydzień choroby bez logowania interpretowany jako tydzień "normalny, bez confounderów").

**Co zbudować:** UI — jedno tapnięcie przy powrocie po przerwie w logowaniu (np. wykryte automatycznie: >2 dni bez żadnego wpisu w `vanguard_stream`, potem pierwszy wpis po przerwie) z pytaniem "przerwa: OK / chory / podróż". Zapisz do `behavior_log` jako oznaczenie okna czasowego. Silnik korelacji (rozszerzenie `correlationEngine.ts`) wyklucza oznaczone okna z obliczeń zamiast je błędnie interpretować jako "normalne dni bez confounderów".

### 5.2 Licznik pokrycia metryk — cicha śmierć rur danych

**Problem:** katalog korelacji ma ~80 metryk (`correlationCatalog.ts`). Nic nie mierzy, jaki procent dni każda metryka faktycznie ma wartość. Jeśli np. rura `screen_time_min` przestanie działać (integracja się zepsuje), korelacje z jej udziałem po cichu głodują — `n` spada poniżej progu w `correlationInterest.ts`, insighty znikają bez żadnego alarmu.

**Co zbudować:** krok w `vanguard-nightly` liczący, dla każdej metryki z katalogu, % dni z niepustą wartością w ostatnich 30 dniach. Zapisz do nowej tabeli `metric_coverage_stats` albo do istniejącego mechanizmu audytu (`supabase/functions/_shared/audit.ts` / `audit_events`, już wspomniane w pamięci agenta jako "error log"). Wyświetl w panelu zdrowia systemu — pozycja #39 z głównej Master listy audytu ("Panel zdrowia systemu z audit_events — lusterko wsteczne, nie alert").

### 5.3 Korekty LLM giną bezpotomnie

**Problem:** gdy Jakub poprawia wynik LLM (kategorię z `vanguard-auto-classify`, kalorie z `parse-food-nl`, zadanie z `vanguard-todo-extract`/`vanguard-todo-classify`) — poprawka po prostu nadpisuje wiersz w bazie. Nic nie rejestruje, że to była korekta BŁĘDU modelu (w odróżnieniu od zwykłej edycji treści), więc model nigdy się z tych błędów nie uczy.

**Co zbudować:** dodaj kolumnę `corrected_from` (JSON, poprzednia wartość) do tabel, gdzie użytkownik może poprawić output LLM (np. `friction_events`, `todo_items`, `daily_food_entries` — konkretna lista zależy od tego, gdzie UI już umożliwia edycję). Przy budowie rejestru promptów (pozycja #45 z głównej Master listy audytu, "LLM gateway + rejestr promptów + evals") — wykorzystaj ostatnie N korekt jako few-shot examples wstrzykiwane do promptu odpowiedniego klasyfikatora. To zamyka pętlę: błędy → korekta → przykład → mniej błędów, bez żadnego nowego inputu poza tym co Jakub i tak robi.

### 5.4 Zero obsługi cykliczności w silniku korelacji

**Sprawdzone bezpośrednio grepem:** `supabase/functions/_shared/correlationEngine.ts` i `correlationSeries.ts` nie zawierają żadnej wzmianki o dniu tygodnia, sezonie, semestrze (`dayOfWeek`, `weekday`, `season` — zero trafień). Cały silnik liczy pary metryk tego samego dnia, liniowo. Poniedziałek i niedziela są dla systemu tym samym punktem danych. Sesja egzaminacyjna (Jakub studiuje na PRz, sesje wracają cyklicznie co pół roku) będzie za każdym razem traktowana jako świeża "anomalia", nigdy jako rozpoznany wzorzec.

**Co zbudować:** dodaj cechy cykliczne jako metryki pierwszej klasy do katalogu (`correlationCatalog.ts`): `day_of_week` (0-6), `days_to_exam` (jeśli kalendarz ma oznaczone bloki uczelni — patrz też pozycja #8 z głównej Master listy audytu "kalendarz semantyczny", ten punkt jest jej analitycznym odpowiednikiem: tamta daje przyszłe obciążenie, ta uczy z przeszłych cykli). W silniku korelacji dodaj opcję stratyfikacji — licz korelację osobno per dzień tygodnia / per okres semestru, nie tylko zbiorczo.

### 5.5 Pogoda i fotoperiod nie karmią korelacji

**Sprawdzone bezpośrednio grepem:** "weather"/"pogod" w kodzie występuje tylko w `supabase/functions/analyze-training-load/analysis.ts` i w UI kalendarza (świeży commit `f259bb7c feat(calendar): show hourly weather in the time gutter`). **Nie ma go w `correlationCatalog.ts`** — czyli pogoda jest widoczna wizualnie w kalendarzu, ale nie wchodzi do żadnej analizy korelacyjnej.

**Co zbudować:** integracja z Open-Meteo (darmowe API, bez klucza) — nowa rura, najlepiej jako część nightly: pobierz dla lokalizacji Jakuba temperaturę, ciśnienie, godziny światła dziennego, godzinę zachodu słońca. Zapisz jako dzienne kolumny (nowa tabela `daily_weather` albo rozszerzenie `vanguard_daily_aggregates`). Dodaj te metryki do `correlationCatalog.ts`. Priorytet uzasadniony problemem zdrowotnym #1 Jakuba: pora zasypiania (patrz pamięć agenta `user_sleep_protocol` — problem to pora zasypiania ~01:00, nie środowisko) — fotoperiod jest jednym z najsilniej udokumentowanych driverów rytmu dobowego w literaturze, a dziś system go w ogóle nie widzi.

### 5.6 Analityka bez modelu confounderów

**Problem:** `behavior_log` ma kolumny na klasyczne confoundery (alkohol, choroba, podróż, stres — widoczne w etykietach `correlationCatalog.ts:72-75`: `alcohol_units`, `travel_day`, `illness_day`, `stress_manual`), ale silnik korelacji (na ile sprawdzone) liczy surowe pary bez stratyfikacji po nich.

**Co zbudować:** minimalna wersja — przy liczeniu korelacji, dla par gdzie potencjalny confounder istnieje w oknie próby, dodaj do `evidence_text` (już istniejące pole, widoczne w `outcomes.ts`) flagę w stylu "N z M dni próby zawierało [alkohol/chorobę]". Pełna wersja — stratyfikacja: licz korelację osobno dla dni z i bez confoundera, porównaj siłę. Bez tego np. "późny posiłek psuje sen" może być w rzeczywistości efektem tego, że późne posiłki korelują z piciem alkoholu.

---

## Ludzie i świat zewnętrzny

### 6.1 Maraton nie istnieje jako obiekt w systemie

**Kontekst z pamięci agenta** (`project_running_profile`): VO2max 47.1, cel sub-4h Koszyce 4.10.2026, trener Igor, gap +2.9 do celu, PR 1K 4:25.

**Problem:** system mierzy trening (Strava sync, strain engine, `rescore-workout-sessions`), ale nigdzie nie reprezentuje, że istnieje PLAN treningowy do konkretnego celu z konkretną datą. Sprawdzone: `database.types.ts` ma `target_duration_min` (linie 3639+) na poziomie pojedynczych treningów, ale nic na poziomie "plan vs wykonanie" względem maratonu jako całości. Nie ma trendu VDOT/tempa liczonego względem celu, nie ma countdownu, nie ma "planned-vs-executed" na poziomie tygodnia treningowego.

**Co zbudować:** dossier wyścigu — konkretna instancja "dossier celu" (4.7). Krok w nightly aktualizujący: prognozę czasu maratonu z ostatnich biegów (formuła Riegela albo podobna — tu naturalnie wchodzą wzory z repo `C:\Users\jakub\Desktop\woooop`, patrz pamięć agenta `project_noop_algorithms`: "dokładne wzory recovery/strain/illness/dose-response do przepisania na Vanguard"), planned-vs-executed treningu tygodnia, countdown do 2026-10-04. To pierwszy realny konsument dla wzorów z woooop — dose-response ma sens dopiero policzony względem planu, nie w próżni.

### 6.2 Vanguard jest single-player, cel #1 ma drugiego gracza

**Problem:** zero interfejsu dla trenera (Igor). `exportStats` (`src/components/core/stats/exportStats.ts`) to backup-dla-człowieka, dla samego Jakuba (pozycja #56 głównej Master listy). Igor programuje trening albo na ślepo, albo na podstawie tego co Jakub mu ustnie powie — podczas gdy Vanguard codziennie liczy strain, recovery, illness signal, RPE, volume.

**Co zbudować:** cotygodniowy raport dla trenera — on-demand link (statyczna strona/PDF) albo Telegram-forward zawierający: trend objętości treningowej, recovery, flagi choroby/przemęczenia, RPE rzeczywiste vs zaplanowane. Zero codziennego inputu od Jakuba (dane już są), jeden nowy widok/eksport. To pierwszy zewnętrzny (poza Jakubem) konsument danych Vanguarda — inna klasa dźwigni niż wszystko inne w tym dokumencie, bo wpływa na decyzje osoby trzeciej, która bezpośrednio programuje trening pod cel sub-4h.

---

## Frontend / infrastruktura (dotknięte przy audycie, do dopisania do właściwego backlogu technicznego)

### 7.1 Pół-migracja na react-query

**Sprawdzone:** `QueryClientProvider` wpięty niedawno (commit `c7533ff3 chore: wire up QueryClientProvider`), ale obok niego istnieje 29 ręcznych hooków fetch+useState w `src/hooks/` (`useCalendarTodos.ts`, `useDashboardData.ts`, `useLifeGoals.ts`, itd. — pełna lista przez `ls src/hooks`). Pół-migracja jest gorsza niż dowolny z końców: dwa równoległe modele cache i invalidacji.

**Dlaczego to należy do tego dokumentu, nie tylko do tech-debt:** offline write queue (pozycja #20 głównej Master listy) i realtime invalidation potrzebują JEDNEGO modelu danych żeby działać spójnie. Dokończenie migracji na react-query to warunek wstępny, nie kosmetyka — rób PRZED #16 (router), #17 (sync storm), #20 (offline), nie po.

---

## Kolejność wykonania (rekomendacja)

1. **Partia 0** z głównej Master listy audytu (bez zmian — backup, zielony typecheck, commity, itd. — to zawsze pierwsze, niezależnie od tego dokumentu)
2. **1.1** Write-back `proposed_memory` → graf (największa dźwignia/koszt ze wszystkiego w tym dokumencie — 1 wieczór, odblokowuje ścieżkę zamkniętą od Sprint 0.7)
3. **1.2** Kalibracja prognoz (metryka nadrzędna — mówi ci później, co jeszcze naprawdę trzeba zbudować)
4. **1.3** Pompa active learning (wymaga 1.1 jako warunku wstępnego)
5. **2.3** Ledger nightly (bo wszystko inne stoi na tym, że nightly faktycznie się wykonuje)
6. **2.2 krok 1** — audit rozbieżności repo vs deployed edge functions (żeby wiedzieć skalę problemu "repo ≠ produkcja" zanim zaczniesz cokolwiek nowego pisać)
7. Reszta Priorytetu 2/3 oraz sekcja "Graf wiedzy" — przy najbliższym dotknięciu odpowiednich funkcji (zasada skauta, nie osobna sesja per punkt)
8. Sekcje "Uczciwość danych" i "Ludzie i świat zewnętrzny" — kandydaci na sierpień, kiedy dev spada do ~3-4h/tydz (pamięć agenta `project_vanguard_july_polish_phase": wszystko tu jest czysto kompilacyjne — nightly pisze, Jakub czyta, zero nowego codziennego inputu)

## Zasada zamykająca (nie dokładaj kolejnych punktów do tej listy bez powodu)

Po wdrożeniu 1.2 (kalibracja prognoz) masz obiektywny sygnał, czego jeszcze brakuje: **jeśli krzywa błędu predykcji się wypłaszcza, to znak że modelowi głoduje konkretna zmienna — dopiero wtedy dokładaj nowy sensor** (lokalizację, CO2 w sypialni, cokolwiek). Nie odwrotnie. To jest mechanizm, który ma zastąpić ręczne audyty tego typu w przyszłości — system sam wskaże następną lukę, zamiast człowieka (albo agenta) zgadującego, czego może brakować.
