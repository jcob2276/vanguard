# Plan: System planowania jako 1 organizm (dzień → tydzień → miesiąc → 12-tyg → rok)

> **Status dokumentu:** PLAN — zaprojektowane 2026-06-30, nic poniżej (poza tym co już oznaczone ✅) nie jest zaimplementowane.
> **Dla AI agentów:** to jest źródło prawdy o docelowym kształcie systemu planowania. Przed budową kolejnej fazy przeczytaj całość — nie buduj fazy 3 zanim 1-2 nie żyją w praktyce. Aktualizuj status faz po każdym wdrożeniu.
> Powiązane: [[project_plan_module]] (pamięć agenta), `lessons.md` (wpisy 2026-06-30).

## 1. Cel i zasada nadrzędna

Jakub: *"To ma być 1 organizm, ma prowadzić usera za rękę"*. Jeden komunikat, jedna spójność —
nie pięć równoległych miejsc gdzie żyją cele/liczby/refleksje. Priorytet **teraz**: spięcie
podsumowania tygodnia z KPI i stanem projektów (bo po to robi się review tygodnia — żeby
ogarnąć co się działo i jaki jest stan projektów życiowych). Budżety godzin per sfera
(ciało/duch/konto) to **dodatek na później**, świadomie poza zakresem tego planu.

Zasada projektowa: **każdy poziom czasu (dzień/tydzień/miesiąc/sprint) odpowiada na to samo
pytanie z innym zoomem — "co się dzieje z moimi projektami i czy idę w stronę celu" —
i każdy poziom karmi się danymi z poziomu niżej, nie wymaga ręcznego przepisywania.**

## 2. Diagnoza obecnego stanu (2026-06-30, po dzisiejszej sesji)

### ✅ Już działa
- **goalSpine.ts** — SSOT łączący dzień→tydzień→sprint→cel długoterminowy, jeden fetch,
  testowane (`goalSpine.test.ts`, `goalSpineGuide.test.ts`).
- **Dzień → Tydzień (liczby)** — `daily_wins.task_N_target_value` + `task_N_project_id`
  → auto-rollup do `kpi_entries` przez RPC `increment_kpi_entry_for_week`, ale **tylko gdy
  projekt ma dokładnie 1 KPI** (PowerList.tsx toggleTask + goalSpine.ts rollupTaskCompletion).
- **WeekHub → ProjectWeekKpis** — sekcja "Projekty tego tygodnia" pokazuje aktywne projekty
  z ich KPI (wartość/cel, pasek postępu), inline edycja celu.
- **SpineGuideStrip / deriveSpineGuidance** — "prowadzenie za rękę" już istnieje jako
  mechanizm (jeden komunikat na zakładce Dziś, priorytet: sprint → tydzień → refleksja →
  KPI → 5 zwycięstw), ale pokrywa tylko dzień/tydzień/zamknięcie sprintu — nie miesiąc.

### ❌ Główne dziury (w kolejności wpływu na "1 organizm")

> **Update 2026-06-30 (sesja sprzątania P0–P2):** Punkt 1 poniżej jest już nieaktualny —
> `WeeklyReview.tsx` i `weekly_kpi_reviews` zostały usunięte tego samego dnia (zob.
> `docs/FEATURE_LIFECYCLE.md` → "Legacy WeeklyReview & WeeklyBrief: Dropped"), Tydzień to
> teraz jeden ekran (`WeekHub`/Direction). Punkt 5 (`goals`) został zrealizowany — tabela
> dropnięta migracją `20260630164658_drop_dead_career_and_goals_schema`.

1. ~~**Tydzień to wciąż DWA ekrany.**~~ ROZWIĄZANE 2026-06-30 — `WeeklyReview.tsx` usunięty,
   `weekly_kpi_reviews` dropnięte, Tydzień skonsolidowany do jednego ekranu (Direction ritual).
2. **Brak wieczornego domykacza dnia.** Jedyna refleksja dnia to wolne pole
   `daily_plan.shutdown_note` / `daily_wins.day_note`, bez UI, bez połączenia z resztą
   pipeline'u friction (`confirmed_friction_events`, `system_proposals`).
3. **Monthly review nie istnieje.** Zero tabeli, zero widoku agregującego 4-5 tygodni.
4. **Sprint (12-tyg) jest cienki.** `sprint_reviews.reflection` to jedno wolne pole tekstowe.
   Zero: agregacji KPI/projektów z całego sprintu, zero carry-over niedokończonych
   projektów/KPI do kolejnego sprintu, `sprint_goals.goal_text` to wolny tekst niepowiązany
   z `goal_kpis`/`projects`.
5. ~~**Martwa tabela `goals`**~~ ROZWIĄZANE 2026-06-30 — dropnięta migracją
   `20260630164658_drop_dead_career_and_goals_schema`.

## 3. Docelowa architektura — jedna struktura na każdym poziomie

Każdy poziom (Tydzień / Miesiąc / Sprint) ma być **tym samym wzorcem**, różnym zoomem:

```
[Projekty aktywne + ich KPI: wartość vs cel]   ← z poziomu niżej, automatycznie
[Co zadziałało / co nie zadziałało]            ← JEDNO pole reflection, nie dwa
[AI brief]                                      ← synteza powyższego
[Decyzja na następny okres]                     ← cele/target na kolejny tydzień/miesiąc/sprint
```

To eliminuje pytanie "gdzie wpisuję refleksję tygodnia" (dziś: dwa różne miejsca,
`weekly_reviews.proud_of/sabotage/...` vs `weekly_kpi_reviews.what_worked/what_didnt_work` —
częściowo to samo pytanie, dwa formularze).

## 4. Fazy (budować w tej kolejności, żyć z każdą 1-2 tyg przed kolejną)

### Faza 1 — Scalenie DANYCH Tydzień, nie ekranów (NAJWYŻSZY PRIORYTET)

**Decyzja zapadła (2026-06-30, potwierdzona przez Jakuba):** dwa ekrany to NIE problem —
mają różny, świadomy rytm: `WeekHub` to żywy pulpit sprawdzany dowolnie często
("co się dzieje teraz"), `WeeklyReview` to rytuał raz w tygodniu (niedzielne zamknięcie).
Usuwanie tego podziału byłoby błędem. Problem leży POD spodem — w danych i braku mostu
między ekranami. Trzy konkretne rozjazdy do naprawienia:

1. **Dwie listy KPI patrzące na to samo z innego kąta.** `ProjectWeekKpis.tsx` (WeekHub,
   zbudowany dziś) grupuje `goal_kpis` po `project_id`. `WeeklyReview.tsx` (`PILLARS.map`,
   linia ~321) grupuje te same `goal_kpis` po `pillar`. User musi mentalnie rekoncyliować
   dwa sortowania tej samej listy.
   **Fix:** `WeeklyReview.tsx` przestaje grupować po pillar, renderuje **ten sam komponent**
   `ProjectWeekKpis` (read-only/edytowalny tryb) zamiast własnej pętli `PILLARS.map`+
   `KpiEntryCard`. Pillar staje się tagiem widocznym przy KPI, nie osią grupowania.
2. **Dwa formularze refleksji pytające o prawie to samo.**
   `weekly_kpi_reviews.what_worked/what_didnt_work` vs
   `weekly_reviews.proud_of/do_differently/sabotage/obligation/week_highlight/week_regret/new_belief`
   — nakładające się pytania w dwóch osobnych tabelach/formularzach.
   **Fix:** jeden formularz w UI (w `WeeklyReview.tsx`, miejsce dzisiejszych dwóch
   textarea "Co zadziałało/nie zadziałało"), zapis pod spodem nadal idzie do obu tabel
   (`saveWeeklyReviewReflection` + `saveWeeklyKpiReview` z jednego submitu) — bez migracji
   DB na start, czysto UI-level konsolidacja pytań.
3. **Brak mostu.** Otwarcie `WeeklyReview.tsx` zaczyna się od pustego formularza (`setupMode`
   / KPI inputs), nie pokazuje tego co user już widział w WeekHub przez cały tydzień.
   **Fix:** na górze `WeeklyReview.tsx`, przed formularzem refleksji, read-only recap z tych
   samych danych co WeekHub: `ProjectWeekKpis` (projekt→KPI, wartość/cel), `WeekLoopSummary`
   stats (dni zalogowane, wins done/set). Otwarcie ekranu ma czuć się jak "zoom out na to co
   już przeżyłem", nie nowy formularz od zera.
4. **Brak widocznego mostu w drugą stronę.** W WeekHub dodać jeden wyraźny CTA
   "Zrób podsumowanie tygodnia →" widoczny gdy czas (mechanizm już istnieje:
   `weekReflectionOverdueDays` z `useSpineGuidance.ts`, naprawiony 2026-06-30) — user nie
   ma dziś żadnego linku z WeekHub do WeeklyReview poza nudge w SpineGuideStrip.

`AI brief` (`vanguard-weekly-brief`) ma dziś dostęp tylko do `goal_kpis`+`kpi_entries`
(4 tyg trend) — rozszerzyć kontekst o `activeProjects` (status, czy są bez KPI w ogóle)
i o friction z tygodnia (`confirmed_friction_events`), żeby brief odpowiadał dokładnie na
pytanie Jakuba: "co się działo i jaki jest stan projektów życiowych".

### Faza 2 — Wieczorny domykacz dnia

- Nowy krok w `PowerList.tsx` (albo osobny komponent wywoływany z Dashboard pod wieczór):
  pokazuje dzisiejsze 5 zwycięstw (zrobione/nie), pyta JEDNO pytanie "co nie poszło i
  dlaczego" — zapis idzie do tego samego miejsca co reszta friction (`confirmed_friction_events`
  albo nowa kolumna w `daily_wins`, ale **czytana przez ten sam pipeline** co
  `system_proposals`/`vanguard-analyst`, nie osobny silos).
- To naturalnie zasila Fazę 1: "co nie poszło w tygodniu" w review tygodnia powinno być
  agregatem z 7 dni tego pytania, nie nowym wolnym tekstem pisanym od zera w niedzielę.

### Faza 3 — Monthly review

- Nowa tabela `monthly_reviews` (wzorem `sprint_reviews`): `month_start`, `reflection`,
  `completed_at`.
- Nowy widok: agregat `kpi_entries` z 4-5 `week_start` tego miesiąca (trend per KPI),
  lista projektów ze zmianą statusu w tym miesiącu (`active`→`done`/`paused`), zliczenie
  tygodni z `weekly_reviews.review_completed_at` (ile tygodni w miesiącu user faktycznie
  zrobił review — sam w sobie sygnał).
- `deriveSpineGuidance` (goalSpineGuide.ts) dostaje nowy krok: nudge o monthly review gdy
  miesiąc się kończy i reviewu nie ma (wzorem istniejącego `sprint_close` gate).

### Faza 4 — Sprint (12-tyg) jako prawdziwy agregat

- `sprint_goals.goal_text` (wolny tekst) zostaje, ale **dodatkowo** sprint może mieć
  powiązane `goal_kpis` (przez nowe pole `goal_kpis.sprint_linked boolean` albo po prostu
  query: KPI projektów które były `active` w trakcie sprintu) — żeby zamknięcie sprintu
  (`sprint_reviews`) mogło pokazać twardy: "target 400 diali/tydzień × 12 tyg, zrobione X".
- Zamknięcie sprintu (`sprint_reviews.completed_at`) dostaje strukturalne pola zamiast
  jednego `reflection`: co osiągnięte / co przeniesione na kolejny sprint (lista projektów
  ze statusem `active`, które nie są `done` — sugestia carry-over, user potwierdza).
- Ten sam wzorzec co Faza 1: AI brief na poziomie sprintu, czytający miesięczne agregaty.

### Faza 5 — Rozszerzenie SpineGuideStrip na pełny zoom

- `deriveSpineGuidance` dziś kończy się na dniu/tygodniu/zamknięciu sprintu. Dodać kroki:
  monthly review overdue, sprint carry-over pending. Jeden pasek na Dziś nadal pokazuje
  TYLKO najpilniejszą rzecz (priorytet już ustalony w kodzie) — Faza 5 tylko rozszerza
  listę rzeczy, które ten priorytet bierze pod uwagę.

## 5. Świadomie POZA zakresem tego planu

- Budżety godzin per sfera (ciało/duch/konto) — Jakub: "to są dodatki". Wracać do tego
  dopiero po tym jak Fazy 1-2 przetrwają w praktyce 2-3 tygodnie (zgodnie z wcześniejszą
  rekomendacją w [[project_plan_module]] — manualne logowanie godzin jest najsłabszym
  ogniwem, nie budować bez potwierdzenia że reszta się trzyma).
- Tabela `goals` (martwa, zero referencji w kodzie) — usunąć przy najbliższym sprzątaniu
  martwego kodu, nie wciągać do architektury.
- Obsługa projektu z 2+ KPI w auto-rollupie (`rollupTaskCompletion` dziś celowo pomija) —
  do rozważenia dopiero jeśli w praktyce się okaże że to częsty przypadek.

## 6. Kolejny krok

Zacząć od **Fazy 1, Opcja A** (scalenie WeekHub + WeeklyReview w jedną zakładkę) — to
bezpośrednia odpowiedź na "jeden komunikat, jeden organizm" i nie wymaga migracji danych,
tylko przeniesienia UI. Przed startem: `EnterPlanMode` z konkretnym layoutem (co disappeared,
co zostaje, kolejność sekcji) do zatwierdzenia.
