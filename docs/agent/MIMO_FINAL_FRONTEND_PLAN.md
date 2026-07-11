# Plan finalny dla MIMO — cała reszta frontendu, jeden dokument

To jest kontynuacja bezpośrednio po zakończeniu **P5** (MorningPlanModal ✓, CalendarGrid ✓,
LinksInbox ✓, TodoCard — dokończ jeśli jeszcze w toku). Ten dokument zawiera **całą
pozostałą pracę frontendową** ustaloną w dzisiejszej rozmowie: resztę `LEGACY_FILES`
(P6), resztę DS1 (modale/spinnery/empty states), resztę DS4 (audyt responsywności).

**Tryb pracy: jedź przez wszystko poniżej bez zatrzymywania się na pełną weryfikację
(typecheck/lint/test/ratchet) po każdym pliku — to robisz RAZ, na samym końcu, po
wszystkim.** Nie ma znaczenia ile to potrwa. Poniższe zasady higieny **nie są
"testowaniem"** — są częścią poprawnego wykonania, rób je na bieżąco:

- Audyt `notify(`/`console.warn(`/`console.error(` — policz w oryginale przed edycją,
  suma w nowych plikach musi być ≥ oryginału (patrz "Twardy checklist" niżej)
- Sync ścieżek w `eslint.config.js` i `scripts/ops/legacy-lines-baseline.json` po
  każdym przeniesieniu/usunięciu pliku — rób to od razu, nie na końcu, inaczej błędy
  się skumulują i będzie trudniej je rozdzielić

---

## FAZA 0 — Sprzątanie martwych wpisów w `LEGACY_FILES` (zrób najpierw, ~15 min, zero ryzyka)

**Odkrycie:** 75 z 116 plików na liście `LEGACY_FILES` jest **już dziś pod limitem 300
linii** — to stare wpisy sprzed wcześniejszych sesji refaktoryzacji, nikt ich nie
wykreślił. Zero kodu do zmiany, tylko czyszczenie list.

Usuń z `eslint.config.js` (`const LEGACY_FILES = [...]`) i z
`scripts/ops/legacy-lines-baseline.json` wszystkie poniższe ścieżki (wszystkie mają
dziś ≤300 linii, więc automatycznie łapią się pod domyślne zasady ESLint bez wyjątku):

```
src/components/todo/WeeklyReviewModal.tsx
src/components/lifestyle/direction/hooks/useDirection.ts
src/components/lifestyle/WeeklyBalanceHexagon.tsx
src/components/lifestyle/links/useLinksInboxData.ts
src/components/biometrics/MuscleHeatmap.tsx
src/components/lifestyle/Direction.tsx
src/components/todo/TodoSidebar.tsx
src/components/lifestyle/DirectionRadarMode.tsx
src/components/core/useNutritionData.ts
src/components/todo/ContextMenu.tsx
src/components/identity/Photos.tsx
src/components/projects/GoalCreateModal.tsx
src/components/projects/Projects.tsx
src/components/core/Fundament.tsx
src/components/lifestyle/direction/hooks/directionActions.ts
src/components/core/SearchModal.tsx
src/components/todo/TodoDatePickerPopover.tsx
src/components/medical/MedicalStudiesPage.tsx
src/components/todo/TodoQuickCapture.tsx
src/components/desktop/shell/useDesktopData.ts
src/components/core/Dashboard.tsx
src/components/desktop/health/SystemHealth.tsx
src/components/lifestyle/DirectionSprintMode.tsx
src/components/growth/PinPickerModal.tsx
src/components/desktop/vision/DreamsPanel.tsx
src/components/growth/GrowthCockpit.tsx
src/components/core/DailySnapshotCard.tsx
src/components/ai/ChatItems.tsx
src/lib/todo/todoParser.ts
src/components/core/stats/TrainingAnalysisSection.tsx
src/components/ai/OracleCard.tsx
src/components/lifestyle/ProjectWeekKpis.tsx
src/components/lifestyle/WeekHub.tsx
src/lib/health/workoutLogging.test.ts
src/components/calendar/hooks/useCalendarTodos.ts
src/components/core/nutrition/NutritionTrainingBar.tsx
src/components/desktop/fitness/Heatmap.tsx
src/components/ai/ClarificationRequestCard.tsx
src/components/integrations/StravaWidget.tsx
src/components/biometrics/SaunaLoggerModal.tsx
src/lib/offlineQueue.ts
src/lib/health/supplementsClient.ts
src/components/notes/NoteQuickCapture.tsx
src/components/projects/LifeGoalsCard.tsx
src/components/todo/EisenhowerMatrix.tsx
src/components/growth/SkillRadarPanel.tsx
src/components/core/stats/WorkoutHistorySection.tsx
src/components/desktop/vision/useDreamsData.ts
src/components/notes/NoteCard.tsx
src/components/insights/InsightsDashboard.tsx
src/components/growth/GrowthSkillsList.tsx
src/components/desktop/vision/VisionBoardPanel.tsx
src/components/core/NutritionChart.tsx
src/components/todo/TodoScanTextModal.tsx
src/lib/projects/lifeGoals.ts
src/components/growth/GrowthLearningPanel.tsx
src/hooks/useSyncActivities.ts
src/components/lifestyle/direction/hooks/directionFetcher.ts
src/components/todo/KanbanView.tsx
src/components/desktop/vision/DreamEditModal.tsx
src/components/cards/CardFactory.tsx
src/components/projects/projectUtils.ts
src/components/core/DashboardModals.tsx
src/components/desktop/fitness/MarathonPanel.tsx
src/components/lifestyle/PowerListTask.tsx
src/components/desktop/general/IntelligencePanel.tsx
src/components/desktop/health/HabitsPanel.tsx
src/components/projects/RetroModal.tsx
src/components/lifestyle/PowerListKpi.tsx
src/components/lifestyle/directionHelpers.ts
src/components/todo/DragGhost.tsx
src/lib/aiContext.ts
src/lib/goal/goalLineage.ts
src/components/desktop/fitness/SprintPanel.tsx
src/lib/supabaseUtils.ts
```

Po usunięciu z obu list: `npx eslint <kilka z powyższych losowo>` — upewnij się że nie
wyskakują nowe błędy (jeśli któryś wciąż ma resztki `as any`/za długą funkcję, to
osobny, mniejszy problem — zostaw komentarz w commit message, nie blokuj na tym reszty).

**Commit:** "P6 FAZA 0: usuń 75 martwych wpisów z LEGACY_FILES (już pod limitem)".

---

## FAZA 1 — Realne rozbicia (37 plików, faktycznie >300 linii)

### Tier 3 — ostrożnie, jeden plik = jedna sesja, plan tekstowy przed edycją (4 pliki)

Rób w tej kolejności:

1. **`src/lib/stats/exportStats.ts`** (928 linii) — to plik logiki (brak JSX), prawdopodobnie
   eksport/agregacja statystyk. Przeczytaj cały, podziel wg naturalnych sekcji
   (prawdopodobnie: różne typy raportów/eksportów jako osobne funkcje w osobnych plikach,
   plus jeden plik orkiestrujący). To największy pojedynczy plik w całym repo.
2. **`src/components/lifestyle/usePowerListData.ts`** (745 linii, hook z 7 `useState`) —
   przeczytaj, podziel wg wzorca z `useMorningPlanData`/`useMorningPlanActions` z P5
   (dane osobno od akcji/derived values).
3. **`src/components/projects/ProjectCard.tsx`** (613 linii) — karta projektu, prawdopodobnie
   podobna struktura do `TodoCard.tsx` z P5 (sekcje: header, KPI, checkpointy, akcje).
   Użyj tego samego wzorca podziału co przy TodoCard (osobne hooki dla niezależnych
   kawałków stanu, subkomponenty dla sekcji JSX).
4. **`src/components/lifestyle/direction/hooks/useDirectionContext.ts`** (605 linii) —
   hook, prawdopodobnie już częściowo rozbity wcześniej (sąsiaduje z `useDirection.ts`,
   `directionActions.ts`, `directionFetcher.ts`, `directionKeys.ts` w tym samym
   folderze) — sprawdź czy da się dociągnąć logikę do istniejących sąsiadów zamiast
   tworzyć nowe pliki.

Dla każdego: przeczytaj cały plik, napisz plan (lista: nowy plik → co w nim, ile linii
szacunkowo), **jedno zdanie potwierdzenia od Jakuba lub ode mnie wystarczy**, potem
wykonaj. Audyt `notify`/`console` obowiązkowy.

### Tier 2 — umiarkowane, 1 plik/commit, bez planu-do-akceptacji (21 plików)

Rób w tej kolejności (od największego):

```
src/components/growth/GrowthView.tsx (595)
src/components/core/nutrition/FoodEntryModal.tsx (579)
src/components/desktop/fitness/FitnessScorePanel.tsx (577)
src/components/core/nutrition/useFoodEntryData.ts (572)
src/components/desktop/shell/DesktopDashboard.tsx (564)
src/components/lifestyle/DirectionPlanningMode.tsx (548)
src/components/calendar/useCalendarData.ts (547)
src/lib/goal/goalSpine.queries.ts (528)
src/lib/health/workoutLogging.ts (522)
src/components/desktop/health/SupplementsPanel.tsx (495)
src/components/core/NutritionCard.tsx (493)
src/components/lifestyle/PowerList.tsx (474)
src/components/calendar/CalendarView.tsx (461)
src/components/desktop/general/GeneralView.tsx (457)
src/components/biometrics/WorkoutLogger.tsx (442)
src/components/core/stats/FoodAnalysisSection.tsx (433)
src/components/notes/EditNoteModal.tsx (425)
src/components/core/nutrition/FoodQuickCapture.tsx (422)
src/components/desktop/desktopUtils.ts (413)
src/components/medical/EndMyopiaCalculator.tsx (408)
src/components/core/DailyShutdownModal.tsx (407)
```

Wzorzec do zastosowania: jeśli plik ma JSX + dane (fetch/mutacje) → Container/View split
(dane do hooka `use<Nazwa>Data.ts`, JSX zostaje). Jeśli plik jest już czystym hookiem
(`.ts`, brak JSX) → podziel wg odpowiedzialności (np. fetch osobno od mutacji osobno od
derived values), jak `useMorningPlanData`/`useMorningPlanActions` w P5.

### Tier 1 — mechaniczne, batch do 3 plików/commit (12 plików)

```
src/components/biometrics/workout/ExerciseCard.tsx (390)
src/components/calendar/CalendarEventModal.tsx (389)
src/components/core/Stats.tsx (387)
src/lib/health/foodLogging.ts (386)
src/components/growth/hooks/useGrowthData.ts (384)
src/components/correlations/CorrelationsPage.tsx (379)
src/components/desktop/general/HexagonPanel.tsx (365)
src/lib/dailyPlanProposal.ts (361)
src/data/exercises.ts (358)
src/components/biometrics/DailyStrainCard.tsx (348)
src/lib/goal/goalSpine.mutations.ts (345)
src/components/growth/GrowthWeekPlan.tsx (321)
```

Te są tylko lekko ponad limit — zwykle jedno wydzielenie (mały hook albo subkomponent)
wystarczy żeby zejść pod 300.

**Stała reguła dla całej Fazy 1:** po każdym pliku który znika z listy albo spada pod
300 — usuń go z `LEGACY_FILES`/`legacy-lines-baseline.json` od razu (nie zbieraj na koniec).

---

## FAZA 2 — Dokończenie DS1 (modale, spinnery, empty states)

### Modale — 9 plików z ręcznym `fixed inset-0` (poza `ui/Modal.tsx`/`ui/ConfirmDialog.tsx`)

```
src/components/core/DailyShutdownModal.tsx
src/components/core/DashboardFastCapture.tsx
src/components/core/MorningPlanModal.tsx
src/components/core/nutrition/FoodEntryModal.tsx
src/components/core/SearchModal.tsx
src/components/insights/InsightCard.tsx
src/components/medical/EndMyopiaCalculator.tsx
src/components/shared/ActionCenterSheet.tsx
src/components/todo/WeeklyReviewModal.tsx
```

Dla każdego: przeczytaj, oceń czy pasuje do `ui/Modal` (props: `isOpen`, `onClose`,
`title`, `subtitle`, `size`, `showCloseButton`, `closeOnBackdropClick`). Jeśli ma prosty
header+content+footer → migruj. Jeśli ma nietypową strukturę (multi-step wizard jak
`MorningPlanModal.tsx` — **ten akurat już ma customowy header z paskiem tygodnia i
progress line, prawdopodobnie zostaje jako świadomy wyjątek, oceń sam**) — zostaw z
komentarzem w kodzie czemu, nie na siłę.

### Spinnery — 25 plików z `animate-spin` poza `ui/Spinner.tsx`

```bash
grep -rln "animate-spin" src/components | grep -v "ui/Spinner.tsx"
```

**Uwaga (już odkryta w DS1):** większość to legalne ikony Lucide (`<Loader2
className="animate-spin" />`, `<RefreshCw className="animate-spin" />`) — to NIE są
kandydaci do migracji, to inny wzorzec (obracająca się ikona, nie div-spinner). Migruj
**tylko** samodzielne `<div className="animate-spin rounded-full ...">` bez ikony w
środku — to prawdziwy odpowiednik `ui/Spinner.tsx`.

### Empty states — 30 plików z `border-dashed` poza `ui/EmptyState.tsx`/`todo/EmptyState.tsx`

```bash
grep -rln "border-dashed" src/components | grep -v "ui/EmptyState.tsx\|todo/EmptyState.tsx"
```

Migruj na `<EmptyState icon label action?/>` tam gdzie pasuje (pusty stan listy/karty).
`todo/EmptyState.tsx` (drag-target) zostaje osobno, nie łącz z `ui/EmptyState.tsx`.

---

## FAZA 3 — Dokończenie DS4 (audyt responsywności)

Sprawdzone dziś: Kalendarz, Todo, Keep, Rozwój, Projekty, Dziś. **Zostały:** Desktop
(`/dashboard`), Growth do końca, Medical, Settings, Tydzień, Historia.

Dla każdego widoku, na 375px i 1280px:
1. Sprawdź horizontal overflow (`document.documentElement.scrollWidth >
   window.innerWidth`)
2. Sprawdź console errors (0 tolerowane)
3. Sprawdź touch targets <44px na mobile — jeśli dużo (>20), oceń czy to gęsta
   nawigacja (jak mini-kalendarz, akceptowalne) czy realny problem UX
4. Sprawdź czy sidebar/nav chowa się poprawnie na mobile (dokładnie ten typ buga co w
   `TodoSidebar.tsx` dzisiaj — sprawdź każdy widok z bocznym panelem)

Napraw znalezione realne bugi (jak `notes.css`/`TodoSidebar.tsx` dzisiaj) od razu, w
osobnych, małych commitach per bug.

---

## NA SAM KONIEC — jedna pełna weryfikacja całości

Dopiero po Fazach 0-3 w całości:

```bash
npm run typecheck:ui
npm run lint
npm run test
npm run ratchet:frontend
npm run audit:knip
```

Napraw wszystko co czerwone. Potem zgłoś do mnie — zrobię pełny code review próbki
(nie każdego z ~50+ commitów, ale reprezentatywnej próbki z każdej fazy) + wizualną
weryfikację głównych widoków w przeglądarce, tak jak przy P5.

## Stałe zasady przez całość (nie negocjowalne)

- Nie dotykaj `RichEditor.tsx`, `database.types.ts`
- Nie dopisuj nowych plików do `LEGACY_FILES` żeby ominąć limit
- Zero zmian zachowania — to czysty refaktor, bugi które zauważysz po drodze notuj
  osobno, nie napraw w tym samym commicie (wyjątek: bugi znalezione w Fazie 3 DS4,
  tam naprawa jest częścią zadania)
- Audyt `notify`/`console` per plik — obowiązkowy, nawet w Fazie 0/Tier 1
