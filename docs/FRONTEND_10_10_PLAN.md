# Frontend 10/10 — Raport z audytu i plan działania (2026-07-10)

> Wynik audytu frontendu z 2026-07-10 + plan doprowadzenia `src/` do stanu 10/10.
> Zasada nadrzędna: **każda naprawa = fix + mechanizm wymuszający w CI**. Naprawa bez
> strażnika wraca po trzech sesjach — to nie opinia, to historia tego repo
> (audyt 2026-07-09 → tydzień później FRONTEND_GUIDE miał 4 nieaktualne sekcje).
>
> Powiązane: [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md) (konwencje), [BUG_TECH_DEBT_BACKLOG.md](BUG_TECH_DEBT_BACKLOG.md)
> (starszy backlog — częściowo się pokrywa, odhaczaj w obu), [VISION_10_10.md](VISION_10_10.md) (10/10 produktowo).

---

## Definicja 10/10 (mierzalna, nie uznaniowa)

Frontend jest 10/10, gdy **wszystkie** poniższe są prawdą i CI to egzekwuje:

| # | Kryterium | Jak mierzone |
|---|-----------|--------------|
| 1 | CI zielone: lint, ratchety, knip, testy | istniejący pipeline |
| 2 | Każda klasa anty-wzorca ma licznik, który może **wyłącznie maleć** | ratchet v2 (sesja S1) |
| 3 | Zero znanych bypassów `sanitizeHtml` + testy wektorów ataku | `keepUtils.test.ts` |
| 4 | Zero surowych dat UTC dla "dziś" i zero ręcznych przesunięć dat | licznik + `lib/date.ts` |
| 5 | Jedna ścieżka wywołań edge functions (`invokeEdge`) | licznik `functions/v1` = 0 |
| 6 | Błędy: user-akcja → `notify`, best-effort → `console.warn`, nic trzeciego | licznik `[Background Error]` = 0 |
| 7 | Zero martwych eksportów i zależności | knip w CI (już jest) |
| 8 | Dokumentacja zgodna z kodem (FRONTEND_GUIDE zweryfikowany) | sesja S9 + data weryfikacji w nagłówku |

**Czego NIE robimy** (to by obniżyło ocenę, nie podniosło): big-bang rewrite na react-query,
nowe abstrakcje ponad istniejące (`invokeEdge`, `Modal`, `EmptyState` już są — problem to adopcja),
hurtowe refaktory god-files poza ratchetem. Lipiec = polish, pionowe plastry, zasada skauta.

---

## Wzorcowa struktura (rubryka oceny)

Każda ocena pliku/modułu w tym planie i w przyszłych audytach odwołuje się do jednej
z tych czterech etykiet — zamiast osądu ad hoc "wygląda nieporządnie".

### Wzorzec A — Feature Module

Dla modułów z danymi i stanem (`todo/`, `calendar/`, `core/nutrition/`, `notes/`,
`desktop/`, `growth/`, `lifestyle/`, `projects/`, `medical/`, `biometrics/`):

```
components/<feature>/
├── index.ts                  # fasada — jedyne, co świat zewnętrzny importuje
├── <Feature>Container.tsx    # DANE: useQuery/*Api, stan, efekty. Zero JSX poza <View {...props}/>
├── <Feature>View.tsx         # WIDOK: czysty prezenter — layout, JSX, style. Zero fetch/mutacji
├── hooks/                    # logika interakcji specyficzna dla modułu
├── subcomponents/            # klocki UI używane tylko wewnątrz modułu
└── <feature>Utils.ts         # czyste funkcje pomocnicze specyficzne dla modułu
```

**Próg zastosowania:** plik >300 linii (limit lintera) LUB miesza dwie odpowiedzialności
(fetch+JSX) niezależnie od rozmiaru. **Reguła rozstrzygająca podział:** plik z logiką
danych (`useQuery`/`*Api`) albo plik z JSX — nigdy oba naraz w jednym pliku.

Wzorcowy przykład: `components/todo/` — Container/View rozdzielone, `hooks/` z 11 wąsko
wyspecjalizowanymi hookami, `weekly/` jako zagnieżdżony pod-moduł (wzorzec jest rekurencyjny).

### Wzorzec B — Type Registry

Dla modułów renderujących "jedna rzecz, wiele wariantów" bez własnego stanu (`cards/`,
`widgets/`): `Factory.tsx` (typ → komponent) + podfoldery wg taksonomii domenowej
(`entities/`, `temporal/`, `textual/`...), nie wg warstwy technicznej. Już poprawnie
zrobione w tym repo — nie dotykać, tylko rozpoznawać przy ocenie nowych modułów tego typu.

**Rozróżnienie A vs B:** jeden ekran/funkcja z jednym stanem → A. "Renderuj X zależnie
od typu Y" bez własnego stanu → B.

### Reguła progu dla `lib/`

Grupa tematyczna plików w `lib/` płasko jest OK poniżej **6-8 plików** (nazwa pliku
wystarcza za nawigację). Powyżej progu — dostaje podfolder. `*Api.ts` (warstwa dostępu do
danych) NIE dostaje własnego katalogu technicznego (`lib/api/`) — zostaje przy swojej
domenie (np. `medicalApi.ts` przy `medicalAnalytics.ts`), bo grupujemy wg domeny (feature),
nie wg roli technicznej — spójnie z zasadą modułów w `components/`.

**Pełny rejestr `src/lib/` (84 pliki, bez `database.types.ts` — generowany, zostaje w
korzeniu; regeneracja: `npm run db:update-types`):**

| Docelowy folder | Pliki | Uwagi |
|---|---|---|
| `lib/goal/` | `goalSpine.ts` (fasada), `goalSpine.types.ts`, `goalSpine.queries.ts`, `goalSpine.mutations.ts`, `goalSpine.test.ts`, `goalSpineGuide.ts`, `goalSpineGuide.test.ts`, `goalLineage.ts`, `longTermBridge.ts` | 9 plików |
| `lib/growth/` | `growth.ts`, `growthMastery.ts`, `growthOverview.ts`, `growthSeed.ts`, `growthSkills.ts`, `growthWeek.ts`, `sprintUtils.ts`, `sprintReview.ts`, `sprintReview.test.ts`, `monthReview.ts`, `monthReview.test.ts`, `monthCarry.ts`, `monthCarry.test.ts` | 13 plików. `checkpoints.ts` i `dailyPlanProposal.ts` **do zweryfikowania grepem przed przeniesieniem** — konsumowane przez kaskadę dzień→tydzień→miesiąc, mogą pasować tu lub zostać w core |
| `lib/health/` | `workoutLogging.ts`, `workoutLogging.test.ts`, `bodyMetrics.ts`, `bodyMetrics.test.ts`, `foodLogging.ts`, `nutritionContext.ts`, `caffeineEstimate.test.ts` (patrz niżej), `medicalAnalytics.ts`, `medicalApi.ts`, `medicalRetestSuggestions.ts`, `medicalRetestContext.ts`, `muscleMapData.ts`, `plyoMarathonProgram.ts`, `strainRefresh.ts`, `supplementsClient.ts` | 15 plików. `fitnessScore.ts` **USUŃ** (patrz niżej, nie przenoś) |
| `lib/behavior/` | `behaviorCapture.ts`, `behaviorEvidence.ts`, `behaviorLogClient.ts`, `captureBridge.ts`, `streamReview.ts` | 5 plików |
| `lib/projects/` | `projects.ts`, `projectEvidence.ts`, `lifeGoals.ts`, `lifeSpheres.ts`, `pillars.ts` | 5 plików |
| `lib/todo/` | `todo.ts`, `todoApi.ts`, `todoParser.ts` | 3 pliki — zostaje w `lib/` (warstwa domeny), NIE łączyć z `components/todo/` mimo tej samej nazwy — to złamałoby warstwę lib→components |
| zostaje płasko w `lib/` (infrastruktura, brak jednego właściciela-domeny) | `supabase.ts`, `supabaseUtils.ts`, `queryClient.ts`, `notify.ts`, `constants.ts`, `date.ts`, `date.test.ts`, `offlineQueue.ts`, `imageThumbnail.ts`, `htmlCardTemplates.ts`, `aiContext.ts`, `agentSystemPromptHelper.ts`, `systemProposals.ts`, `vanguardCore.ts`, `solar.ts`, `insightsApi.ts`, `calendarApi.ts`, `todoApi.ts`* | ~17 plików |
| zostaje płasko (`*Api.ts` bez wystarczająco dużej grupy domenowej obok) | `linksApi.ts`, `notesApi.ts`, `oracleApi.ts`, `identityVaultApi.ts`, `systemApi.ts`, `predictionsApi.ts`, `biometricsApi.ts` | 7 plików |
| `lib/stats/` (już istnieje) | `exportStats.ts` | **Konflikt nazw do naprawy:** `components/core/stats/` ma własny `statsApi.ts`/`statsCalculations.ts` — dwa różne katalogi `stats` w dwóch miejscach drzewa. Rozważ `lib/stats/exportStats.ts` → `lib/exportStats.ts` (spłaszczyć, bo to jeden plik) |
| **USUŃ, nie przenoś** | `fitnessScore.ts`, `correlations.ts` | Gołe re-eksporty `export * from '@vanguard/domain'` — martwa pośredniość. 5 konsumentów (`FitnessScorePanel.tsx`, `fitnessScore.test.ts`, `BehaviorEffectCard.tsx`, `CorrelationCard.tsx`, `CorrelationsPage.tsx`) przepiąć na bezpośredni import z `@vanguard/domain` |
| **Przenieś, nie tylko przegrupuj** | `caffeineEstimate.test.ts` | Testuje `supabase/functions/_shared/caffeineEstimate.ts` (edge function), a leży w `src/lib/` — przenieś obok źródła które testuje, do `supabase/functions/_shared/caffeineEstimate.test.ts` (tam już jest wzorzec — `correlationEngine.test.ts`, `time.test.ts` leżą przy swoich modułach) |

*`todoApi.ts` wystąpił dwa razy w oryginalnym rozpoznaniu (raz jako część grupy `todo`,
raz jako pojedynczy plik) — **przypisanie ostateczne: `lib/todo/`** razem z `todo.ts` i
`todoParser.ts`, usuń z listy "zostaje płasko".

### Reguła własności dla `hooks/`

Nie "ile plików", tylko: **czy hook ma jednego właściciela-feature, czy jest naprawdę
cross-cutting?**

**Pełny rejestr `src/hooks/` (34 pliki) — konsumenci zweryfikowani grepem, nie zgadywani
z nazwy (kilka pierwszych przypuszczeń po nazwie okazało się błędnych przy weryfikacji —
np. `useSolarData` i `useTimeBudgets` należą do `calendar/`, nie do `desktop/`/`lifestyle/`):**

| Docelowy folder | Pliki | Zweryfikowani konsumenci |
|---|---|---|
| `lifestyle/direction/hooks/` | `directionActions.ts` (249), `directionFetcher.ts` (138), `directionKeys.ts` (48), `useDirection.ts` (298), `useDirectionContext.ts` (604) | Największy klaster w repo — 1337 linii. `useDirectionContext.ts` to zarazem najdłuższy hook |
| `growth/hooks/` | `useGrowthData.ts` (383), `useGrowthWeekRecap.ts` (150), `useSpineGuidance.ts` (204) | — |
| `medical/hooks/` | `useMedicalData.ts` (72), `useMedicalRetestContext.ts` (90), `useFaceDistance.ts` (149) | `useFaceDistance` konsumowany przez `EndMyopiaCalculator` |
| `calendar/hooks/` | `useCalendarTodos.ts` (197), `useCalendarWrite.ts` (50), `useTodayCalendarEvents.ts` (51), `useAIScheduling.ts` (109), `useSolarData.ts` (47), `useTimeBudgets.ts` (67) | Zweryfikowane: `useAIScheduling`→`CalendarView.tsx`; `useSolarData`→`SolarDayWidget.tsx`; `useTimeBudgets`→`CalendarView.tsx`+`CalendarContext.tsx` |
| `core/hooks/` (Dashboard) | `useDashboardData.ts` (194), `useDashboardState.ts` (239), `useDashboardSwipeNav.ts` (47), `useNudgeData.ts` (62) | Zweryfikowane: `useNudgeData`→`DesktopDashboard.tsx`+`useDashboardState.ts` (mimo nazwy sugerującej desktop, konsument to dashboard state) |
| `projects/hooks/` | `useLifeScoreboard.ts` (181), `useLifeGoals.ts` (30) | — |
| `insights/hooks/` | `useUserStatsSnapshot.ts` (95) | Zweryfikowane: `InsightsDashboard.tsx`+`UserStatsOverviewCard.tsx` |
| `biometrics/hooks/` | `useWorkoutResume.ts` (31) | — |
| cross-domain sync (integracje, nie jedna domena UI) — **zostaje globalnie, ale flagowane osobno od "prawdziwie globalnych"** | `useSyncActivities.ts` (151), `useSyncOura.ts` (115), `useSyncActions.ts` (90) | Konsumowane przez `StravaWidget`, `DailyStrainCard`, `DesktopDashboard` — brak jednego właściciela, to integration layer, nie feature |
| **zostaje w `src/hooks/`** (prawdziwie globalne) | `useNotifications.ts`, `useHaptics.ts`, `usePersistentDraft.ts`, `useWarsawDayChange.ts`, `usePushNotifications.ts`, `useGoalSpineInvalidation.ts` | `useGoalSpineInvalidation` mimo nazwy zostaje globalnie — dane goal-spine renderują się jednocześnie w Dashboard/Projects/Direction/Growth, brak jednego właściciela |

Efekt: `src/hooks/` z 34 plików skurczyłby się do **6 prawdziwie globalnych + 3 sync**
(9 razem), reszta (25) przenosi się do folderów feature.

### Warstwa stylów — co robi co

| Warstwa | Odpowiada za | Przykład |
|---|---|---|
| `tailwind.config.js` | statyczne, znane-przy-buildzie kolory marki/motywu | `bg-primary` |
| `index.css` (CSS custom properties) | dynamiczne/wybieralne w runtime wartości (Tailwind nie generuje klas ze stringów budowanych w runtime, np. `` `bg-${note.color}-500` ``) + globalne tokeny | `var(--keep-bg-red)` |
| Tailwind utility classes w JSX | layout, spacing, typografia — 95% stylowania | `flex items-center gap-2 rounded-xl` |

`index.css` **powinien** być tylko warstwą design tokenów — ale dziś nie jest.
Realna zawartość (sprawdzone liczeniem sekcji, nie szacunkiem): ~510 linii to faktycznie
globalne tokeny/animacje app-shell, ale **~1690 z 2358 linii (72%) to ręcznie pisany CSS
jednego modułu — Keep/Notes** (composer, note card, edytor WYSIWYG, FAB, wikilinks, AI
companion), plus mniejsze bloki dla `MuscleHeatmap` (biometrics) i motywu Todo. `--keep-*`
(kolory notatek, ~80 zmiennych) są używane wyłącznie w `components/notes/` — zweryfikowane
grepem, zero leaków. To nie jest "duży plik tokenów", to komponentowy CSS trzymany w złym
miejscu z przyzwyczajenia. Konkretny plan podziału → sesja S8b.

---

## Sesje robocze

Jedna sesja = jeden temat = jeden commit (reguła #10). Kolejność jest celowa:
najpierw odblokowanie CI, potem **maszyna egzekwująca**, potem naprawy, na końcu adopcja ciągła.

### S0 — Odblokuj CI (BLOKER, ~15 min)

Working tree obecnie **obleje ratchet**:

- [ ] `src/components/projects/Projects.tsx` — 268 linii (limit 262): wydziel dopisany fragment do hooka/subkomponentu, albo świadomie podnieś limit w `scripts/ops/legacy-lines-baseline.json` z uzasadnieniem w commicie
- [ ] `src/components/projects/projectUtils.ts` — 130 linii (limit 125): jw.

**DoD:** `npm run ratchet:frontend` zielony.

### S1 — Ratchet v2: liczniki wzorców (~1-2h) ⭐ najważniejsza sesja planu

Rozszerz `scripts/ops/check-frontend-ratchets.mjs` o sekcję `PATTERN_COUNTERS`:
grep po `src/`, porównanie z baseline w `scripts/ops/ratchet-baseline.json`,
fail gdy licznik **urósł**, komunikat "shrunk — lower the baseline" gdy zmalał
(dokładnie ten sam mechanizm co istniejące listy).

| Licznik (wzorzec grep) | Baseline dziś | Cel | Egzekwuje kryterium |
|---|---|---|---|
| `[Background Error]` | 54 | 0 (S4) | #6 |
| `/functions/v1/` poza `lib/supabase.ts` | 22 | 0 (S6) | #5 |
| `setUTCDate(` w `components/` + `hooks/` | ~30 | 0 (S5) | #4 |
| `toISOString().slice(0, 10)` + `toISOString().split('T')[0]` | ~26 | ~0 (S5) | #4 |
| `as any` | 105 | maleje | higiena typów |
| `fixed inset-0` | 21 plików | maleje | adopcja `ui/Modal` |
| `session: Session` w propsach komponentów | 53 | maleje | adopcja `useUserId()` |

- [ ] Implementacja liczników + baseline'y = stan dzisiejszy
- [ ] Wpis w FRONTEND_GUIDE §6 (jedno zdanie: "ratchet liczy też wzorce, patrz tabela w skrypcie")

**DoD:** nowy kod nie może dodać ŻADNEGO wystąpienia żadnego wzorca — to jest cała
"odporność na przyszłe edity". Od tej sesji reszta planu to zbijanie liczników.

### S2 — Security: `sanitizeHtml` (~2h)

`src/components/notes/keepUtils.ts:13` — jedyna bariera przed HTML-em z LLM
(`HtmlCard.tsx` renderuje szablony Oracle przez `dangerouslySetInnerHTML`).

- [ ] Bypass 1: `href=" javascript:alert(1)"` — wiodąca spacja omija `/^javascript:/i` (przeglądarka strippuje białe znaki w schemacie). Fix: normalizuj `attr.value.replace(/[\s\x00-\x1f]/g, '')` przed testem
- [ ] Bypass 2: `java\tscript:` / znaki kontrolne w schemacie — załatwia ta sama normalizacja
- [ ] Zamień blocklistę `javascript:` na **allowlistę schematów**: `http:`, `https:`, `mailto:`, `tel:`, relative. Wszystko inne (w tym `data:`) — usuń atrybut
- [ ] Filtruj też `src`, `srcset`, `formaction`, `srcdoc`, `xlink:href` — nie tylko `href`
- [ ] **Test `src/components/notes/keepUtils.test.ts`**: happy path + każdy wektor z tej listy + `<img onerror>` + zagnieżdżony `<script>`. Test to strażnik — bez niego następny edit "uprości" regex z powrotem

**DoD:** wszystkie wektory czerwone przed fixem, zielone po; test w `npm run test`.

### S3 — Correctness: strefy czasowe (~1h)

- [ ] `src/hooks/useSolarData.ts:32` — `new Date().toISOString().slice(0,10)` porównywane z datą warszawską → `getTodayWarsaw()`
- [ ] `src/components/medical/AddPrescriptionModal.tsx:20` — domyślna data z UTC → `getTodayWarsaw()` (jest też w BUG_TECH_DEBT_BACKLOG P4 — odhacz tam)
- [ ] `src/components/calendar/calendarHelpers.ts:5,8` — fallback `+02:00` w `getWarsawOffset`: zimą zwróci błędny offset. Zdecyduj: throw (nieparsowalna data = bug wyżej) albo wylicz z `combineDateTimeWarsawISO`
- [ ] **Test DST** dla `getWarsawOffset`: data styczniowa → `+01:00`, lipcowa → `+02:00`, dzień zmiany czasu

**DoD:** liczniki `toISOString` spadają o ~3; test DST w suite.

### S4 — Error handling: triage `[Background Error]` (~2-3h)

54 wystąpienia w 30 plikach — mechanicznie wstawione catch-e, część połyka błędy akcji użytkownika.
Reguła podziału (FRONTEND_GUIDE §3):

- akcja użytkownika (klik/zapis) nie powiodła się → `notify(message, 'error')`
  — przykład zbrodni: `SupplementsPanel.tsx:87` (`handleToggle` — klik suplementu, cicha porażka)
- best-effort (localStorage, prefetch, telemetria) → `console.warn` z nazwanym tagiem modułu
- ładowanie widoku → `error` z react-query / `DataStateNotice`, nie własny state

- [ ] Przejdź wszystkie 54 (lista: `grep -rn "\[Background Error\]" src/`)
- [ ] Zbij licznik ratcheta do 0 i ustaw baseline = 0

**DoD:** licznik `[Background Error]` = 0; żadna mutacja po kliku nie failuje bez toastu.

### S5 — Dedup dat: `shiftDateStr` + `dayLabel` (~2h, mechaniczne)

- [ ] ~30 ręcznych kopii `new Date(Date.UTC(...)) → setUTCDate(±n) → toISOString().slice(0,10)` zamień na `shiftDateStr` z `lib/date.ts`. Wszystkie sprawdzone kopie są poprawne (kotwica `T12:00:00Z`) — to czysta mechanika, zero zmian zachowania. Główne skupiska: `ContextMenu.tsx:66-81`, `useUserStatsSnapshot.ts:77-80`, `desktopUtils.ts:19-23` (`daysBefore`), `SupplementsPanel.tsx:43-51`, `useDesktopData.ts:26-30`, `directionHelpers.ts`, `TodoCard.tsx:168`, `lifeSpheres.ts:100-102`
- [ ] `dayLabel` ("dziś/wczoraj") — 4 implementacje → jedna w `lib/date.ts`: `calendarHelpers.ts:54`, `useFoodEntryData.ts:78`, `magazineBar.ts:23`, `keepUtils.ts:4` (`relativeDate`). Zostaw wariant modułowy tylko, gdy format faktycznie inny — wtedy niech woła wspólny rdzeń
- [ ] Zbij liczniki `setUTCDate(` i `toISOString().slice/split` do ~0

**DoD:** liczniki ~0; `npm run test` zielony (testy dat już istnieją w `date.test.ts`).

### S6 — Jedna ścieżka edge calls: `invokeEdge` (~2h, mechaniczne)

`invokeEdge()` istnieje (`src/lib/supabase.ts:9`) i działa — problem to 22 miejsca
z ręcznym `fetch(VITE_SUPABASE_URL + '/functions/v1/...')` + kopiowanym nagłówkiem auth.

- [ ] Dotypuj helper: `invokeEdge<T = unknown>`, `body?: unknown` (zakaz `as any` — reguła #5 konstytucji)
- [ ] Migruj 22 wywołania (lista: `grep -rn "functions/v1" src/`) — uwaga na dwa z query-stringiem GET (`lookup-food?q=`) i na `AbortSignal`
- [ ] 12 bezpośrednich `supabase.functions.invoke()` możesz zostawić (to samo pod spodem) albo przepiąć przy okazji — nie rób z tego osobnej pracy
- [ ] Licznik `functions/v1` → 0, baseline = 0

**DoD:** żaden plik poza `lib/supabase.ts` nie skleja URL-i edge functions.

### S7 — Martwy kod + typy (~1h)

- [ ] `src/store/useStore.ts:63` `useUserId` — NIE usuwaj: to narzędzie sesji S10 (prop-drilling). Użyj go w pierwszym komponencie już teraz, żeby knip zamilkł i wzorzec był widoczny
- [ ] `src/components/todo/useTodoData.ts:18` — usuń nieużywany typ `SmartListRow`
- [ ] `package.json:36` — usuń `@types/suncalc`
- [ ] `src/lib/goalSpine.queries.ts:514` — `userId` jako parametr **wymagany**; usuń martwą gałąź `queryClient.clear()` (nuke całego cache — bomba czekająca na pierwszego nieświadomego callera)
- [ ] `src/components/todo/KanbanView.tsx:40` — usuń zbędny `as any` (`TodoItemUpdate` zawiera `section_id`)
- [ ] `npm run db:update-types` — regeneracja `database.types.ts`; potem sprawdź, czy `useDirection.ts:149-171` (`week_*` przez `as any`) da się dotypować. Jeśli kolumny są w DB, casty znikają za darmo

**DoD:** `npm run audit:knip` czysty; licznik `as any` spada o ~15.

### S8b — Co-lokacja CSS: rozbicie `index.css` (~2-3h)

Vite wspiera natywnie `import './module.css'` w plikach TS/TSX — dokładnie ten sam
mechanizm co import JS, zero konfiguracji. Podział wg realnej zawartości pliku (zweryfikowanej
liczeniem sekcji, patrz rubryka wyżej):

- [ ] `src/components/notes/notes.css` ← linie 524-2072 + 2089-2232 z `index.css` (composer,
      note card, WYSIWYG editor, tagi, FAB, wikilinks, AI companion, backlinks) + wszystkie
      `--keep-*` tokeny (potwierdzone: zero użyć poza `components/notes/`). Import w
      `components/notes/index.ts` albo w głównym pliku wejściowym modułu (np. `Keep.tsx`)
- [ ] `src/components/todo/todo.css` ← sekcja "Todoist Theme Scoped Styling" (koniec pliku)
- [ ] `src/components/biometrics/workout/muscleHeatmap.css` ← sekcja "Anatomiczna mapa mięśni"
      (~15 linii, mała ale jednoznacznie należy tam, nie do globalnego pliku)
- [ ] `index.css` zostaje: tokeny które NIE są `--keep-*` (kolory kalendarza, surface,
      semantic — używane w wielu modułach), `@keyframes`/View Transitions API (jawnie
      cross-cutting — komentarz w kodzie: "used by modals/cards via `animate-fadeIn`"),
      reset/baza Tailwind. Docelowo ~510 linii zamiast 2358
- [ ] Kolejność importów: Vite zachowuje kolejność `import` CSS, więc jeśli
      `notes.css`/`todo.css` nadpisują coś zdefiniowanego w bazowym `index.css`, kolejność
      importu w plikach wejściowych musi to odzwierciedlać — nie zakładaj, testuj wizualnie
- [ ] Weryfikacja: ekran Keep, ekran Todo, MuscleHeatmap przed/po — 1:1, zero regresji
      wizualnej (zrzut screenshot w przeglądarce przed migracją i po, porównanie ręczne)

**Bonus do odnotowania, nie do zrobienia teraz:** `Dashboard` (a więc i Notes wewnątrz)
ładuje się dziś eager w `App.tsx`, nie przez `lazy()` — więc co-lokacja CSS sama w sobie
NIE opóźni załadowania `notes.css` do momentu otwarcia Keep. To wymagałoby osobnej zmiany
(code-splitting routingu Dashboard/Notes), którą co-lokacja CSS jedynie przygotowuje jako
warunek wstępny — nie łącz tych dwóch prac w jednym commicie.

**DoD:** `index.css` < 550 linii; `grep -c "keep-" src/index.css` = 0; zero regresji wizualnej.

### S8 — Architektura: przeprowadzki (~2h)

- [ ] `src/components/biometrics/workout/workoutUtils.ts` → rozdziel: czyste funkcje (`sessionVol`, `isLogWellness`, …) do `src/lib/health/workout.ts` (nowy podfolder z S11); fragmenty z `supabase.from()` do `*Api.ts`. To zamyka **dwa** wpisy list wyjątków naraz (`NO_SUPABASE_IN_COMPONENTS_EXCEPTIONS` + jedyny import lib→components w `workoutLogging.ts:11`) — zmniejsz oba baseline'y w tym samym commicie
- [ ] `src/components/core/OrientationFooter.tsx:5` — importuj `getSprintInfo` z `lib/sprintUtils`, nie przez re-eksport `desktop/desktopUtils`
- [ ] `src/App.tsx:89-94` — odwróć literówkę: `/korelacje` kanoniczne, `/korealcje` → redirect (zostaw redirect na stałe, stare linki/bookmarki)
- [ ] `src/App.tsx:74-98` — wydziel powtórzony 5× spinner fallback do stałej

**DoD:** `grep "from '.*components/" src/lib/` pusty; obie listy wyjątków krótsze.

### S9 — Dokumentacja = kod (~30 min)

FRONTEND_GUIDE.md ma 4 sekcje sprzeczne ze stanem repo (tydzień po napisaniu!):

- [ ] §7 — `invokeEdge()` istnieje (po S6: "jest kanoniczny, raw fetch zakazany ratchetem")
- [ ] §4 — `ui/Modal.tsx` istnieje; zapis: "nowe modale przez `ui/Modal`, licznik `fixed inset-0` tylko maleje"
- [ ] §2 — `goalSpine.cache.ts` usunięty, cache na react-query — wykreśl akapit legacy
- [ ] §1 — `getSprintInfo` mieszka w `lib/sprintUtils.ts`; lista `NO_LIB_COMPONENT_IMPORT_EXCEPTIONS` nie istnieje w `eslint.config.js` — usuń odwołanie
- [ ] Dodaj do nagłówka guide'a linię `Ostatnia weryfikacja z kodem: <data>` — przy każdym audycie odświeżana; nieaktualna data = sygnał do sprawdzenia
- [ ] Wpis w `lessons.md`: "dokumentacja opisująca stan kodu psuje się w tydzień; opisuj mechanizmy (ratchet), nie stany"

### S10 — Adopcja ciągła (zasada skauta, bez osobnych sesji)

Nie rób hurtem — liczniki z S1 pilnują kierunku, ty tylko nie pogarszaj i poprawiaj przy okazji:

- **Modale:** dotykasz pliku z ręcznym `fixed inset-0` → przepnij na `ui/Modal` (21 plików)
- **Empty states:** przenieś `todo/EmptyState.tsx` → `components/ui/` przy pierwszej okazji; dotykasz pliku z inline `border-dashed + emoji` → podmień (28 plików)
- **`session` prop-drilling:** dotykasz liścia drzewa z propem `session` używanym tylko dla `user.id` → `useUserId()` (53 pliki)
- **react-query:** nowy fetch wyłącznie przez `*Api.ts` + `useQuery` (guide §2); stare `useEffect+useState` migruj per-moduł, gdy dotykasz modułu
- **God-files / legacy:** istniejący ratchet linii już to trzyma — każdy dotknięty plik legacy ma zmaleć
- **`maxWarnings` (659):** obniżaj w `package.json` po każdej sesji, która zbiła warningi — to też ratchet

### S11 — Reorganizacja `lib/` wg rejestru (~3-4h, mechaniczne + weryfikacja)

Wykonanie tabeli z sekcji "Reguła progu dla `lib/`" wyżej. Kolejność ma znaczenie —
rób grupy od najmniej powiązanej z resztą planu do najbardziej, żeby nie kolidować z S2-S8:

- [ ] Najpierw **usuń** shimy: `lib/fitnessScore.ts`, `lib/correlations.ts` → przepnij 5 konsumentów na `@vanguard/domain` bezpośrednio
- [ ] Przenieś `caffeineEstimate.test.ts` → `supabase/functions/_shared/`
- [ ] Utwórz `lib/behavior/`, `lib/projects/`, `lib/todo/` (najmniej ryzykowne — mało wzajemnych importów z resztą `lib/`)
- [ ] Zweryfikuj grepem `checkpoints.ts` i `dailyPlanProposal.ts` (konsumenci) przed przypisaniem do `lib/growth/` czy pozostawieniem płasko
- [ ] Utwórz `lib/growth/`, `lib/goal/` (dużo wzajemnych importów między tymi dwiema grupami — rób w jednym commicie, nie osobno, żeby nie zostawić repo w stanie z połowicznie połamanymi importami)
- [ ] Utwórz `lib/health/` (dołącz `workoutUtils.ts` split z S8 tutaj — jedna okazja, jeden zestaw importów do przepięcia)
- [ ] Rozważ `lib/stats/exportStats.ts` → spłaszczyć do `lib/exportStats.ts` (konflikt nazw z `components/core/stats/`)
- [ ] Po każdej grupie: `npm run typecheck:ui` + `npm run test` — nie czekaj do końca całej sesji żeby złapać połamany import

**DoD:** `npm run typecheck:ui` zielony, `npm run test` zielony, `lib/` root ma ~30 plików zamiast 84 (reszta w podfolderach).

### S12 — Reorganizacja `hooks/` wg rejestru (~2-3h, mechaniczne + weryfikacja)

Wykonanie tabeli z sekcji "Reguła własności dla `hooks/`" wyżej.

- [ ] Zacznij od `lifestyle/direction/hooks/` — największy i najbardziej odizolowany klaster (1337 linii, 5 plików), niskie ryzyko kolizji z resztą
- [ ] `growth/hooks/`, `medical/hooks/`, `calendar/hooks/`, `core/hooks/`, `projects/hooks/`, `insights/hooks/`, `biometrics/hooks/`
- [ ] Sync hooks (`useSyncActivities`/`useSyncOura`/`useSyncActions`) — zostają w `src/hooks/` ale oznacz komentarzem w pliku "integration layer, brak jednego feature-właściciela" żeby przyszły agent nie próbował ich przenieść do jednego z konsumentów
- [ ] Po każdej grupie: `npm run typecheck:ui`

**DoD:** `src/hooks/` ma ~9 plików (6 globalnych + 3 sync) zamiast 34.

### S13 — Reorganizacja `desktop/` na podfoldery (~3h, wymaga weryfikacji przed wykonaniem)

`desktop/` to 27 płaskich plików — najgorszy przypadek w `components/`. Propozycja podziału
niżej ma **średnią pewność** (oparta o nazwy + rozmiar, nie o pełny odczyt każdego pliku) —
**zweryfikuj grepem importerów/eksportów każdej grupy przed wykonaniem**, inaczej ta sesja
sama stanie się źródłem błędów zamiast je usuwać.

| Docelowy podfolder | Pliki | Pewność |
|---|---|---|
| `desktop/shell/` | `DesktopDashboard.tsx` (563, kontener główny), `Panel.tsx` (40, generyczny wrapper), `useDesktopData.ts` (232), `DesktopSectionNav.tsx` (34) | wysoka |
| `desktop/hero/` | `DesktopHero.tsx` (174), `CockpitBanner.tsx` (16), `SmartAlerts.tsx` (46) | średnia |
| `desktop/fitness/` | `FitnessScorePanel.tsx` (576), `ScoreboardPanel.tsx` (132), `SprintMetricsGrid.tsx` (115), `SprintPanel.tsx` (11), `MarathonPanel.tsx` (115), `Heatmap.tsx` (191) | średnia |
| `desktop/health/` | `SupplementsPanel.tsx` (494), `SystemHealth.tsx` (228), `HabitsPanel.tsx` (98), `useHabitsData.ts` (101), `LeniePanelMini.tsx` (65) | średnia |
| `desktop/vision/` | `DreamsPanel.tsx` (223), `DreamEditModal.tsx` (140), `useDreamsData.ts` (174), `VisionBoardPanel.tsx` (165) | średnia |
| `desktop/general/` | `GeneralView.tsx` (456), `HexagonPanel.tsx` (364), `IntelligencePanel.tsx` (100), `BehaviorCapturePanel.tsx` (143) | niska — nazwy zbyt ogólne, przeczytaj przed przypisaniem |

- [ ] Przed wykonaniem: dla każdej grupy "średnia"/"niska" pewność — grep importerów, potwierdź że pliki faktycznie renderują się razem (np. czy `GeneralView.tsx` faktycznie konsumuje `HexagonPanel`/`IntelligencePanel`, czy to przypadkowe sąsiedztwo nazw)
- [ ] `desktopUtils.ts` (412 linii) NIE dostaje własnego podfolderu — to plik do rozbicia z S8 (część do `lib/health/workout.ts`, `getSprintInfo`/`SPRINT_SEASON` już tylko re-eksportowane z `lib/sprintUtils.ts` — usuń re-eksport, przepnij konsumentów na `lib/sprintUtils` bezpośrednio, patrz S8)
- [ ] Po każdej grupie: `npm run typecheck:ui`

**DoD:** `desktop/` root ma ≤5 plików (shell), reszta w 5 tematycznych podfolderach; `desktopUtils.ts` rozbity, nie przeniesiony w całości.

### S14 — Weryfikacja końcowa spójności (~1h)

- [ ] Uruchom pełny rejestr jeszcze raz (powtórz komendy z tej sekcji) — potwierdź że żaden katalog w `components/` nie ma >8 plików płasko bez powodu (Wzorzec B — `cards/`, `widgets/` — wyjątek świadomy)
- [ ] `npm run audit:knip`, `npm run ratchet:frontend`, `npm run lint`, `npm run test`, `npm run typecheck:ui` — wszystko zielone
- [ ] Zrzut ekranu każdego głównego widoku (Dashboard, Desktop, Todo, Calendar, Keep, Growth, Projects) przed/po całej serii sesji S11-S13 — regresja wizualna zero

**DoD:** to jest ostatnia sesja przed uznaniem struktury za 10/10 wg rubryki z tego dokumentu.

---

## Kolejność i szacunek

| Sesja | Temat | Czas | Ryzyko |
|---|---|---|---|
| S0 | odblokowanie CI | 15 min | zero |
| S1 | ratchet v2 (liczniki) | 1-2h | zero — sam pomiar |
| S2 | sanitizeHtml + testy | 2h | niskie |
| S3 | timezone + test DST | 1h | niskie |
| S4 | triage błędów | 2-3h | średnie (dotyka 30 plików) |
| S5 | shiftDateStr/dayLabel | 2h | niskie (mechaniczne) |
| S6 | invokeEdge | 2h | średnie (auth/signal edge-case'y) |
| S7 | dead code + typy | 1h | niskie |
| S8 | przeprowadzki | 2h | średnie |
| S8b | co-lokacja CSS | 2-3h | średnie (regresja wizualna) |
| S9 | docs | 30 min | zero |
| S11 | reorganizacja `lib/` (84→podfoldery) | 3-4h | średnie (dużo importów) |
| S12 | reorganizacja `hooks/` (34→podfoldery) | 2-3h | niskie-średnie |
| S13 | reorganizacja `desktop/` (27→podfoldery) | 3h | średnie (część grup niepewna, wymaga weryfikacji) |
| S14 | weryfikacja końcowa | 1h | zero |

Razem: **~5-6 dni roboczych** rozłożonych na sesje (pierwotne S0-S9 ≈2 dni + rejestr
strukturalny S11-S14 ≈3-4 dni). Mieści się w tygodniu, który zaakceptowałeś jako budżet.
Po S1 każda kolejna sesja jest niezależnie commitowalna i nieodwracalna w dobrym sensie:
licznik zbity do zera + baseline 0, albo plik przeniesiony i zweryfikowany typecheckiem,
znaczy że problem nie może wrócić bez czerwonego CI ani cichej regresji.

**Uwaga o kolejności S11-S13 vs S0-S9:** S11 (reorganizacja `lib/`) koliduje ścieżkami
plików z S5 (shiftDateStr — dotyka wielu plików w `lib/`) i S6 (invokeEdge — też). Rób
**S0-S9 najpierw w całości**, dopiero potem S11-S13 — inaczej masz dwa równoległe zestawy
zmian mutujące te same pliki i konflikty przy mergu gwarantowane.

## Dlaczego to jest "odporne na przyszłe edity"

1. **Ratchety zamiast dyscypliny.** Żadna reguła z tego planu nie opiera się na pamięci
   człowieka ani agenta — wszystko failuje CI. To już działa w tym repo (ratchet złapał
   wzrost `Projects.tsx` w bieżącym working tree).
2. **Testy na klasach bugów, nie na funkcjach.** Test wektorów XSS i test DST strzegą
   *klasy* błędu — następny edit sanitizera czy helpera dat musi przejść przez nie.
3. **Jedna ścieżka na klasę problemu.** Daty → `lib/date.ts`, edge → `invokeEdge`,
   błędy → `notify`/`warn`, modale → `ui/Modal`. Duplikat nie powstanie, bo licznik go odrzuci.
4. **Dokumentacja opisuje mechanizmy, nie stany.** Stany się starzeją (4 sekcje guide'a
   w tydzień) — mechanizmy się egzekwują same.
