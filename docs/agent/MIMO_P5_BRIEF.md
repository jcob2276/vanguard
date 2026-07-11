# Brief dla MIMO — P5: rozbicie największych plików `LEGACY_FILES`

**Nie zaczynaj tego przed skończeniem P1-P4.** Ten brief czeka gotowy na później.

Każdy z 5 plików niżej ma **inny poziom pewności planu** — niektóre są rozpisane
dokładnie (przeczytałem cały plik), inne wymagają Twojego czytania + propozycji przed
edycją. Rób pliki **w podanej kolejności** (od najbezpieczniejszego), **jeden plik = jedna
sesja = jeden commit**, z pełną weryfikacją (typecheck/lint/test/ratchet + wizualnie w
przeglądarce) po każdym.

## Zasady wspólne dla wszystkich 5 plików

1. **Zero zmian zachowania.** To czysty refaktor struktury — jeśli podczas czytania
   zauważysz bug, zanotuj go osobno, nie napraw przy okazji (osobny commit, osobna sesja).
2. Po rozbiciu: `npm run typecheck:ui` → `npx eslint <nowe pliki>` → `npm run test` →
   `npm run ratchet:frontend` → **zrzut ekranu przed/po w przeglądarce** (mobile 375px +
   desktop 1280px) → dopiero commit.
3. Po przeniesieniu — sprawdź `eslint.config.js` (`LEGACY_FILES`) i
   `legacy-lines-baseline.json`: stary plik znika z obu list (albo dostaje 0 linii jeśli
   zostaje jako cienki re-export), nowe pliki dostają wpisy tylko jeśli same przekraczają
   300 linii (małe wydzielone hooki/komponenty zwykle nie przekraczają, więc nie potrzebują
   wpisu w LEGACY_FILES).
4. Zaimportuj `Modal`/`Spinner`/`EmptyState` z `ui/` jeśli plik ma okazję — ale to
   dodatek, nie cel tej sesji. Nie mieszaj DS-owych zmian z P5 w jednym commicie.

---

## Kolejność (od najbezpieczniejszego)

### 1. `src/components/core/MorningPlanModal.tsx` (829 linii) — plan gotowy, wykonuj wprost

Modal 3-krokowego wizarda (poranne planowanie). Jedna instancja na ekranie, izolowany
blast radius. Podział:

**`src/components/core/morningPlan/useMorningPlanData.ts`** (nowy hook — dane + fetch):
- Przenieś: `TodoSlot`, `CalEvent` typy, `PRIORITY_COLORS`, `CAPACITY_HOURS` (stałe)
- Przenieś: cały `useEffect` ładowania danych (linie ~112-240 dzisiejszego pliku —
  fetch yesterdayTasks/todayTasks/inboxTasks/nutritionTarget/powerList/weekCalendarEvents/weekTaskCounts)
- Przenieś stany: `yesterdayTasks`, `todayTasks`, `inboxTasks`, `powerList`, `todayWinId`,
  `nutritionTarget`, `weekCalendarEvents`, `weekTaskCounts`, `loading`
- Hook przyjmuje `{ userId, planningDate, isPlanningTomorrow }`, zwraca wszystkie powyższe
  + settery potrzebne widokowi

**`src/components/core/morningPlan/useMorningPlanActions.ts`** (nowy hook — akcje + derived):
- Przenieś: `handleYesterdayAction`, `handleAssignToSlot`, `handleClearSlot`,
  `handleSubmitPlan`, `activeSlotIdx`/`setActiveSlotIdx`
- Przenieś memo: `dayCalendarEvents`, `calendarMeetingMinutes`, `totalMinutesPlanned`,
  `capacityPct`, `capacityHoursPlanned`, `isOverloaded`, `timelineBlocks`
- Przenieś: `times`/`durations`/`setTimes`/`setDurations` (używane w Step 3, ale logicznie
  część akcji/kalkulacji, nie surowych danych)
- Hook przyjmuje output z `useMorningPlanData` + `{ userId, accessToken, planningDate,
  onClose }`, zwraca wszystkie handlery + wyliczenia

**`src/components/core/morningPlan/morningPlanHelpers.ts`** (czyste funkcje, zero React):
- Przenieś: `addMinutes`, `isoDateStr`, `isoMinutesOfDay`, `isoDurationMin`

**`src/components/core/morningPlan/MorningPlanStep1Review.tsx`** (View, Step 1):
- JSX z bloku `{step === 1 && (...)}` (linie ~534-597) — lista `yesterdayTasks` + akcje
- Props: `yesterdayTasks`, `dayWord`, `onAction: handleYesterdayAction`

**`src/components/core/morningPlan/MorningPlanStep2PowerList.tsx`** (View, Step 2):
- JSX z bloku `{step === 2 && (...)}` (linie ~600-703) — sloty Power List + lista wyboru
- Props: `powerList`, `todayTasks`, `inboxTasks`, `nutritionTarget`, `dayWord`,
  `dayWordAcc`, `activeSlotIdx`, `setActiveSlotIdx`, `onAssign: handleAssignToSlot`,
  `onClear: handleClearSlot`

**`src/components/core/morningPlan/MorningPlanStep3TimeBox.tsx`** (View, Step 3):
- JSX z bloku `{step === 3 && (...)}` (linie ~706-789) — capacity bar, `DayTimeline`,
  lista time-boxingu
- Props: `powerList`, `todayTasks`, `times`, `durations`, `setTimes`, `setDurations`,
  `capacityHoursPlanned`, `capacityPct`, `isOverloaded`, `calendarMeetingMinutes`,
  `totalMinutesPlanned`, `timelineBlocks`, `dayWord`/`dayWordGen`

**`src/components/core/MorningPlanModal.tsx`** (zostaje, ~150 linii):
- Header, week strip, progress line, footer (przyciski Wróć/Dalej/Zatwierdź) — te części
  są małe i specyficzne dla layoutu modala, **zostają inline**, nie wydzielaj ich
- Woła `useMorningPlanData` + `useMorningPlanActions`, renderuje odpowiedni
  `MorningPlanStepN` wg `step`

**DoD:** wszystkie 3 kroki wizarda działają identycznie (przetestuj ręcznie: dodaj
zadanie do Power List, ustaw godzinę w Step 3, zatwierdź plan — sprawdź w bazie że
`daily_win_tasks` i `todo_items.scheduled_time` się zapisały tak jak przed zmianą).

---

### 2. `src/components/calendar/CalendarGrid.tsx` (834 linii) — plan gotowy, ale inny kształt

**Ten plik JUŻ JEST View** (dane przychodzą przez `calData: ReturnType<typeof
useCalendarData>` + props) — to nie jest Container+View split, tylko rozbicie dużego
renderu na mniejsze kawałki. **Większość funkcji renderujących (`renderEventBlock`,
`renderTodoBlock`, `renderTimeGutter`, `renderDayColumn`, `renderAllDayTodos`) jest
WSPÓŁDZIELONA między widokiem dnia i tygodnia** — nie da się ich rozdzielić 1:1 na
"DayView plik" / "WeekView plik" bez duplikacji albo prop-drillingu. Podział:

**`src/components/calendar/grid/CalendarGridBlocks.tsx`** (współdzielone renderery):
- Przenieś: `renderEventBlock`, `renderTodoBlock`, `renderTimeGutter`, `renderDayColumn`,
  `renderAllDayTodos` — jako nazwane funkcje eksportowane (nie domyślny export), każda
  przyjmuje jawne argumenty zamiast domykać się nad zmiennymi z komponentu (np.
  `renderDayColumn(day, { dragSelect, today, nowMin, todosForDay, goalChipFor, ... })`)
- To wymaga przepisania sygnatur tych funkcji na przyjmowanie zależności jako parametr
  obiektowy — **to jedyna nietrywialna część tej sesji**, zrób ją ostrożnie, jedna
  funkcja na raz, typecheck po każdej

**`src/components/calendar/grid/useCalendarDragSelect.ts`** (hook — drag-to-create):
- Przenieś: `dragSelect` state, `useEffect` global mouseup (linie ~87-106),
  `handleColumnMouseDown`, `handleColumnMouseMove`
- Przyjmuje `{ setQuickDuration, setQuickCreate }`, zwraca `{ dragSelect,
  handleColumnMouseDown, handleColumnMouseMove }`

**`src/components/calendar/grid/CalendarDayView.tsx`**:
- `renderDayView` (linie ~512-568) jako osobny komponent, woła funkcje z
  `CalendarGridBlocks.tsx`

**`src/components/calendar/grid/CalendarWeekView.tsx`**:
- `renderWeekView` (linie ~570-663) jako osobny komponent, woła te same funkcje z
  `CalendarGridBlocks.tsx`

**`src/components/calendar/grid/CalendarAgendaView.tsx`**:
- `renderAgendaView` (linie ~665-755) — to jest **jedyny naprawdę niezależny widok**
  (nie dzieli rendererów z Day/Week), przenieś w całości, zero współdzielenia

**`src/components/calendar/CalendarGrid.tsx`** (zostaje, ~60-80 linii):
- `gridRef`, `handleSlotClick`, `eventsByDay`/`getEventsForDay` memo (używane przez
  Day+Week), `useCalendarDragSelect()`, switch na `calView` renderujący odpowiedni widok

**DoD:** wizualnie identyczne dzień/tydzień/agenda. Przetestuj ręcznie: drag-to-create
wydarzenia (dzień i tydzień), drop zadania z todo na slot czasowy, przełączanie widoków.
To jest najbardziej ryzykowna sesja z całej piątki pod względem interakcji — zrzuty
przed/po dla WSZYSTKICH 3 widoków, nie tylko jednego.

---

### 3. `src/components/lifestyle/LinksInbox.tsx` (889 linii) — plan wysokiego zaufania

Klasyczny Container+View mix. Dobra wiadomość: **warstwa danych już istnieje**
(`lib/linksApi.ts` — `apiFetchLinks`, `apiSaveSharedLink`, `apiAddNewLink`,
`apiUpdateLinkTriage`, `apiUpdateLinkNotes`, `apiDeleteLink`, `apiFetchTriageSuggestions`
itd.) — nie ma tu surowego `supabase.from()` do rozplątywania, tylko przeniesienie
istniejących wywołań do hooka.

**`src/components/lifestyle/links/useLinksInboxData.ts`** (nowy hook):
- Przenieś WSZYSTKIE stany z góry pliku (linie 67-87: `links`, `loading`,
  `statusFilter`, `categoryFilter`, `expandedLinkId`, `sharingStatus`, `notesDrafts`,
  `savedNoteId`, `addUrl`, `showAddForm`, `addLoading`, `deletingIds`, `bouncingIds`,
  `convertingLinkId`, `search`, `viewMode`, `triageLoading`, `triageSuggestions`,
  `showTriagePanel`)
- Przenieś WSZYSTKIE handlery: `fetchLinks`, `saveSharedLink`, `handleAddLink`,
  `toggleReadStatus`, `saveNotes`, `deleteLink`, `updateLinkCategory`, `handleLinkToTodo`,
  `handleLinkToNote`, `handleAiTriage`, `applyTriageSuggestion`
- Przenieś: `useEffect` obsługujący deep-link współdzielenia (linie ~144-153)
- Przenieś memo: `filteredLinks`, `unreadCount`
- Hook przyjmuje `{ session }`, zwraca wszystko powyżej

**`src/components/lifestyle/LinksInbox.tsx`** (zostaje jako View):
- `getYouTubeId` helper — **zostaw lokalnie** (czysta funkcja, mała, używana tylko w
  renderze podglądu linku)
- `haptics`/`haptic`/`goTo` — zostają lokalnie, to nawigacyjne helpery UI, nie dane
- Reszta pliku (JSX renderujący listę/karty linków, filtry, formularz dodawania,
  panel triage) zostaje, woła `useLinksInboxData(session)` zamiast lokalnego stanu

**DoD:** dodawanie linku, oznaczanie read/unread, usuwanie, edycja kategorii, konwersja
do todo/notatki, AI triage — wszystko przetestowane ręcznie po rozbiciu.

---

### 4. `src/components/todo/TodoCard.tsx` (869 linii) — WYMAGA Twojego planu przed edycją

**Nie mam pełnego planu dla tego pliku** (czytałem tylko strukturę, nie cały render) —
i to jest karta renderowana dziesiątki razy na ekranie z drag&drop, swipe gestures i
context menu. Błąd tutaj = widoczna regresja w całym Todo, nie w jednym miejscu.

**Zanim cokolwiek zmienisz:**
1. Przeczytaj cały plik
2. Napisz plan podziału jako listę (jak sekcje 1-3 wyżej) — **bez kodu, tylko lista co
   dokąd**
3. Prawdopodobni kandydaci do wydzielenia (potwierdź czytając, nie zgaduj):
   - Gesty swipe (`onTouchStart`/`onTouchMove`/`onTouchEnd`, `onGripTouchStart`/
     `onGripTouchEnd`/`onGripTouchMove`/`onGripMouseDown`, `handleContentMouseDown`,
     stany `touchStartX/Y`, `swipeOffset`, `swipeDir`) → `useTodoCardSwipe.ts`
   - Załączniki (`handleFileUpload`, `handleDeleteAttachment`, stany `attachments`,
     `attachmentsLoaded`, `uploadingFile`) → `useTodoCardAttachments.ts`
   - Reszta (tagi, subtaski, popover daty/przypomnienia, animacja completing) — oceń
     przy czytaniu czy da się wydzielić bez rozrywania blisko powiązanej logiki
4. Poczekaj na potwierdzenie planu (jedno zdanie "rób tak" wystarczy) — dopiero edytuj

**DoD po wykonaniu:** przetestuj ręcznie w przeglądarce — swipe do usunięcia/ukończenia,
drag&drop między sekcjami, dodanie podzadania, załącznik pliku, context menu (prawy
klik/long-press), rozwijanie/zwijanie karty.

---

### 5. `src/components/notes/RichEditor.tsx` (855 linii) — NIE dziel mechanicznie

**Rekomendacja: zostaw ten plik jako świadomy wyjątek, nie licz go do "postępu P5".**

Uzasadnienie: to nie jest plik z pomieszanymi danymi i widokiem — to gęsto powiązana
logika manipulacji `window.getSelection()`/`Range`/`document.execCommand` bezpośrednio
na DOM przez `editorRef`. Prawie każda funkcja (`handleAction`, `insertHTML`,
`checkTriggers`, `executeSlashCommand`, `executeWikiLink`, `handleKeyDown`,
`handleEditorClick`) dzieli ten sam stan zaznaczenia kursora i tę samą referencję do
edytora. Rozbicie na osobne pliki/hooki grozi subtelnymi bugami pozycji kursora, które
są notorycznie trudne do złapania nawet ręcznym testowaniem (wygląda dobrze, kursor
"skacze" tylko w rzadkich sekwencjach klawiszy).

**Jedyne bezpieczne, opcjonalne wydzielenie** (jeśli chcesz coś tu zrobić):
- `SLASH_COMMANDS` (stała tablica, linie 32-39) → osobny plik `richEditorCommands.ts`,
  zero ryzyka, to statyczne dane
- Nic więcej. Zostaw resztę w jednym pliku.

Jeśli mimo wszystko `LEGACY_FILES` ma być tu kiedyś ruszone, to wymaga osobnej,
dedykowanej sesji z realnym testowaniem edytora (pisanie, `/`, `[[`, checklisty, tabele,
zdjęcia) po KAŻDEJ pojedynczej zmianie — nie mechanicznego rozbicia jak pliki 1-3.

---

## Podsumowanie kolejności

| # | Plik | Pewność planu | Ryzyko | Rób |
|---|---|---|---|---|
| 1 | MorningPlanModal.tsx | wysoka (gotowy plan) | niskie (1 instancja) | teraz po P1-P4 |
| 2 | CalendarGrid.tsx | wysoka (gotowy plan) | średnie-wysokie (dużo interakcji) | po #1 |
| 3 | LinksInbox.tsx | wysoka (gotowy plan) | niskie (dane już czyste) | po #2 |
| 4 | TodoCard.tsx | brak — Ty piszesz plan | wysokie (renderowany masowo) | po #3, z akceptacją planu |
| 5 | RichEditor.tsx | świadomie NIE dzielimy | — | pomiń, ewentualnie tylko SLASH_COMMANDS |
