# Feature Backlog — po architekturze, nie po aplikacji

> Wersja 4. Wcześniejsze wersje grupowały po apce źródłowej — złe kryterium. Sort
> poniżej jest wg Twojej zasady z rozmowy: **im więcej istniejących modułów jedna
> mechanika jednocześnie wzmacnia (goal spine, Telegram, Oracle/AI, Memex,
> logi dnia, Oura, Strava, kalendarz), tym wyżej.** App-of-origin zostaje tylko
> jako etykieta w nawiasie, nie jako organizująca oś. Data: 2026-07-02.

---

## Zasada sortująca

Najcenniejsze mechaniki nie dodają nowego ekranu — wzmacniają kilka istniejących
naraz. Przykład z Twojej rozmowy: **Rollover Counter** dotyka planowania dnia,
wieczornej refleksji, analizy tarcia, statystyk i przeglądów tygodniowych jednym
polem w bazie. **Capacity Planning** łączy zadania + energię (Oura/Strava) +
kalendarz. **Task History** karmi Oracle, analitykę zachowań i historię projektów.
**Dynamic Habits** łączy kalendarz, Oura, Stravę i rutyny. To jest kryterium tieringu
poniżej — nie ładność funkcji, tylko liczba modułów którym dodaje wartość za jeden
koszt budowy.

---

## S Tier — rdzeń cyklu życia zadania

Plan → wykonanie → odłożenie → analiza → decyzja. Dziś ten cykl się urywa po
"wykonanie" — nic nie pamięta co się stało z zadaniem, które nie zostało zrobione.

| Mechanika | Wzmacnia | Konkret w Vanguard | Effort |
|---|---|---|---|
| **Rollover Counter** | plan dnia, reconciliation, friction, statystyki, weekly review | `todo_items.postponed_count` + `first_due_date`, inkrementacja przy każdym przesunięciu w przyszłość | S |
| **Rollover Warning** | reconciliation, Pruning Flow | Przy count ≥3 — pytanie w wieczornym reconciliation, nie push. Pull-context, zgodne z zasadą braku alertów | S |
| **Pruning Flow** | weekly review, goal spine | W `WeeklyReview.tsx`: lista zadań z rollover ≥3 → decyzja per zadanie (usuń / rozbij / przenieś do "kiedyś" / zostaw). Bez tego rollover counter to tylko liczba bez akcji | S |
| **Time Estimation** | Capacity Planning, Task History, Oracle | `todo_items.estimated_minutes`, pole przy tworzeniu zadania. Bez tego capacity engine nie ma wejścia poza recovery/sen | S |
| **Capacity Planning** | plan dnia, Oura, Strava, kalendarz, goal spine | `buildDailyPlanProposal` realnie zmienia skład/wielkość planu na podstawie recovery_score/snu/estimated_minutes sumy vs dostępny czas — nie tylko wyświetla liczbę | M |
| **Task History** | Oracle, analityka zachowań, historia projektów | Log ukończonych zadań z `estimated_minutes` vs realny czas (jeśli Time Tracking wejdzie), per projekt/skill — wejście do Oracle RAG i `projectEvidence.ts` | S-M |
| **Objectives Roll-forward** | goal spine (dzień→tydzień→miesiąc→sprint) | Przy zamknięciu tygodnia/miesiąca: niedokończone `sprint_goals`/KPI nie znikają, tylko automatycznie przechodzą do następnego okresu z oznaczeniem `rolled_from` | S-M |
| **Time-horizon Backlog** | plan dnia, Pruning Flow | Trzeci bucket obok "ten tydzień"/"aktywne": `someday` w `todo_items.status` — miejsce na Pruning Flow zamiast usuwania | S |
| **Focus Mode** | plan dnia, Task History | Pełnoekranowy widok jednego zadania + timer start/stop, zapis realnego czasu do Task History | S-M |

### Silnik planowania (Reclaim/Motion) — realnie działający, nie tylko wyświetlający

| Mechanika | Wzmacnia | Konkret w Vanguard | Effort |
|---|---|---|---|
| **Dynamic Habits** | kalendarz, Oura, Strava, rutyny, goal spine | Solver: `habits` dostaje reguły (`freq_per_week`, `not_day_after`, `min_recovery`) → wypełnia konkretne dni w planie na podstawie `daily_strain` + Strava, nie tylko przypomina | M-L |
| **Continuous Replanning** | plan dnia, kalendarz, Task History | Trigger: `sync-calendar` event / niezrobione zadanie / komenda "przelicz dzień" → `buildDailyPlanProposal` liczy cały dzień od nowa na aktualnym stanie | M |
| **Calendar Auto Rescheduling** | kalendarz, plan dnia | Ten sam mechanizm co wyżej, trigger specyficznie z `sync-calendar` diff | wliczone w M powyżej |
| **Deadline-first Scheduling** | plan dnia, Time Estimation, Rollover | `todo_items.due_date` + `estimated_minutes` → solver rozkłada zadanie na dni do deadline zamiast czekać aż user sam podzieli | S-M (nad Capacity Planning) |
| **Workload Analysis** | plan dnia, goal spine, statystyki | `PowerListWeekStats` już liczy done/planned — dodać widok przeciążenia/luzu per dzień tygodnia (Direction) | S |
| **Focus Time Defense** | plan dnia, Capacity Planning | Jeśli suma `estimated_minutes` ≥ capacity dnia — nowe zadanie wymusza wybór (zamień slot / jutro) zamiast bezkarnego dokładania | S |

### Telegram jako silnik rutyn (RoutineFlow) — naturalne rozszerzenie istniejącego kanału

Masz już Telegram jako pełny drugi interfejs (`vanguard-telegram`, router, handlery).
To jedyna kategoria z Twojej listy, którą całkiem pominąłem w poprzednich wersjach —
a pasuje najbardziej naturalnie ze wszystkich, bo nie wymaga nowego kanału wejścia.

| Mechanika | Wzmacnia | Konkret w Vanguard | Effort |
|---|---|---|---|
| **Interactive Telegram Routines** | Telegram, stream, friction, reconciliation | Nowa komenda (`/rano`, `/wieczor`, custom) odpalająca sekwencję pytań krok po kroku, każdy krok = wpis do `vanguard_stream` z `routine_id` + `step_index` | M |
| **Step Timestamping** | friction pipeline, Task History, korelacje | Każdy krok rutyny zapisuje `answered_at` — pozwala liczyć czas między krokami (np. "od pobudki do pierwszego zadania") | wliczone w M powyżej |
| **Routine Bottleneck Analytics** | Oracle, korelacje, weekly synthesis | Query po `step_timestamps`: który krok rutyny systematycznie się wydłuża/jest pomijany — nowa para w `compute-behavior-effects` | S-M |
| **Adaptable Routines** | friction, stream | Krok pomijany automatycznie jeśli dane już są (np. sen już zsynchronizowany z Oura, nie pytaj ponownie) | S |

### Analityka nawyków (TickTick) — dopełnienie tego co już masz

| Mechanika | Wzmacnia | Konkret w Vanguard | Effort |
|---|---|---|---|
| **Quantitative Habits** | Correlation Engine, Oura, Strava | Sprawdzić czy `habit_logs` ma pole liczbowe (dziś prawdopodobnie boolean done/not-done) — dodać `value: number \| null` dla nawyków typu "ile stron/km" | S (do zweryfikowania w kodzie przed wyceną) |
| **Correlation Engine** | wszystko | **Już masz** — `compute-correlations`/`compute-behavior-effects`, lepsze niż TickTick (p-value, Cohen's d) | — |
| **Habit Heatmaps** | nawyki, statystyki | `Heatmap.tsx` w desktop już istnieje — sprawdzić pokrycie, rozszerzyć o habits jeśli tylko trening | S |

---

## A Tier — ergonomia, nie zmienia filozofii

### Ergonomia zadań (TickTick)

| Mechanika | Wzmacnia | Konkret | Effort |
|---|---|---|---|
| Eisenhower Matrix | plan dnia, Pruning Flow | Widok 2×2 z `todo_items.priority` × `due_date` bliskości — czysta wizualizacja istniejących pól | S |
| Smart Filters | Oracle, korelacje | Zapisywalne filtry SQL po `friction_events`/`vanguard_stream`/`habit_logs` (np. "friction, tag=trening, 14 dni, confirmed") | M |
| Subtask Checklists | Task Splitting (patrz B tier) | `todo_items.parent_id` — prostszy niż pełny task-splitting engine, ręczne dodawanie podzadań | S |
| Task Templates | rutyny, projekty | Zapisany zestaw `todo_items` do klonowania (np. "checklist przed wyjazdem") | S |
| Nested Tags | Smart Filters, Oracle | Hierarchia tagów zamiast płaskiej listy — wymaga sprawdzenia obecnego modelu tagów w `todo_items`/`vanguard_stream` | S-M |

### Dzień jako całość (Sunsama)

| Mechanika | Wzmacnia | Konkret | Effort |
|---|---|---|---|
| Internal Calendar | kalendarz, plan dnia | Widok łączący `sync-calendar` events + PowerList sloty w jednej osi czasu | M |
| Daily Time Timeline | plan dnia, Focus Mode | Wizualna oś dnia zamiast listy slotów — UI nad istniejącymi danymi | S-M |
| Daily Summary Digest | reconciliation | Auto-podsumowanie na koniec dnia (zrobione/nie/rollover/recovery) przed wieczornym reconciliation, nie zamiast niego | S |
| Shutdown Ritual | reconciliation | Krótka checklist zamykająca dzień w Telegramie (rutyna z sekcji wyżej) zamiast osobnego feature'a | wliczone w Routines |

### Warstwa wiedzy (Logseq/Tana) — tania wersja nad istniejącym stream+graph

| Mechanika | Wzmacnia | Konkret | Effort |
|---|---|---|---|
| Block References | Memex, Oracle | Cytowanie wpisu stream w innym wpisie — ID już są, brakuje `referenced_entry_id` + UI chip | S |
| Linked/Backlink View | Memex, wiki pages, Oracle | Klik na encję w wiki → lista wszystkich wpisów/friction/reconciliation jej dotyczących, chronologicznie. `vanguard_entity_links` już to wie, brakuje frontendu | S-M |
| Live Queries | = Smart Filters wyżej, ten sam build | — | — |
| Page Properties | wiki, projekty | Proste pola `status`/`priority`/`reviewed_at` na projektach/encjach zamiast pełnego systemu typów (Tana) | S |

### Bufory (Reclaim)

| Mechanika | Wzmacnia | Konkret | Effort |
|---|---|---|---|
| Smart Buffers | plan dnia, kalendarz | Po evencie >60 min → 15 min buforu w proponowanym planie; po treningu → 30 min. Czysta heurystyka czasowa, zero evidence gate potrzebne | S-M |
| Travel Time | kalendarz | Wymaga danych lokalizacji, których dziś nie zbierasz — niski priorytet dopóki nie ma źródła danych | odłożone, brak wejścia |
| Decompression Time | plan dnia | To samo co Smart Buffers po treningu — nie osobny feature | wliczone wyżej |

---

## B Tier — dobre, dopiero po S i A

| Mechanika | Wzmacnia | Uwaga | Effort |
|---|---|---|---|
| Task Splitting | Capacity Planning | Pierwszy feature tworzący **osobny silnik** (LLM tnie zadanie na kroki) — słusznie niżej niż reguły/capacity, bo to nowa klasa złożoności, nie rozszerzenie istniejącej | S-M |
| Pomodoro Logs | Focus Mode, Task History | Rozszerzenie Focus Mode o interwały zamiast jednego stopera | S |
| Floating Focus Widget | Focus Mode | UI polish, mobile-first? sprawdzić czy pasuje do desktop-first profilu Vanguarda | S |
| Web Push Notifications | — | **Koliduje z Twoją zasadą "zero alertów prewencyjnych"** — do jawnej decyzji, nie domyślnie robić | zablokowane, wymaga decyzji |
| Inbox Webhooks / Email-to-Task / Mail Parser | stream, capture | Nowy kanał wejścia obok Telegram/voice — realna wartość tylko jeśli maile faktycznie są źródłem zadań w Twoim życiu (do potwierdzenia) | M-L |
| Routine Triggers / Siri / iOS Shortcuts | Telegram routines | Natywna integracja iOS — wysoki koszt relatywnie do korzyści dla osobistego systemu | L |

---

## C Tier — niski wpływ, nie teraz

White Noise Player, Embedded Spotify, Floating Music, drobne widgety — fajne, zero
dźwigni architektonicznej. Pomijam bez dalszej analizy dopóki S/A/B nie są zrobione.

---

## Odrzucone / odłożone (koszt nieproporcjonalny do zysku)

| Mechanika | Dlaczego |
|---|---|
| Pełny edytor blokowy (Logseq/Tana core UX), whiteboards (Milanote), supertags jako system typów (Tana) | Miesiące budowy UI notatek — Block References + Backlink View + Page Properties dają 80% wartości za ułamek kosztu |
| Finanse (YNAB/Copilot/Monarch) | Zupełnie pusta domena w kodzie — osobna decyzja scope'owa (nowy pion, nie rozszerzenie), nie backlog item |
| Milanote, Notion Calendar, Matter, Fabric, Diarium auto-kontekst pogody, Reflectly mood-AI | Zero dźwigni ponad to co już jest, albo nie pasują do profilu użycia (desktop/Telegram, nie mobile-reading) |

---

## Kolejność wdrażania

1. **Rollover Counter + Time Estimation** [S, S] — dwa pola w `todo_items`, godziny robocze, odblokowują wszystko poniżej.
2. **Capacity Planning realny** [M] — pierwszy silnik, który faktycznie zmienia plan.
3. **Rollover Warning + Pruning Flow** [S, S] — domyka pętlę rollover → decyzja.
4. **Interactive Telegram Routines + Step Timestamping** [M] — nowy kanał wartości bez nowego UI, wykorzystuje istniejący Telegram.
5. **Continuous Replanning + Focus Time Defense + Smart Buffers** [M, S, S-M] — domykają silnik dnia.
6. **Block References + Backlink View + Page Properties** [S, S-M, S] — warstwa wiedzy, tania.
7. **Dynamic Habits solver** [M-L] — najbardziej złożony, najwyższy payoff, robić gdy reszta silnika stoi.
8. **Objectives Roll-forward + Task History** [S-M, S-M] — domykają cykl na poziomie tygodnia/miesiąca.
9. Reszta A-tier (Eisenhower, Smart Filters, Templates, Sunsama-style digest) — w miarę przepustowości.
10. B-tier — po S+A, Web Push wymaga osobnej jawnej decyzji przed startem.
