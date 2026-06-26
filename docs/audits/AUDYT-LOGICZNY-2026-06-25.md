# AUDYT LOGICZNY VANGUARD OS — 2026-06-25

> Oryginalny raport z 25.06.2026 zweryfikowany w kodzie 26.06.2026.  
> Usunięto twierdzenia niepotwierdzone, spekulacyjne, duplikaty podsumowań i sekcje propozycji/wizji.  
> Zostały wyłącznie ustalenia potwierdzone w repozytorium.

---

## Metodologia weryfikacji

Każdy punkt poniżej został sprawdzony bezpośrednio w plikach źródłowych (`grep`, odczyt kodu). Usunięto m.in.:

- **Fałszywe:** brak `TELEGRAM_CHAT_ID` „otwiera bota na każdy czat” (przy `authorizedChatId = 0` wiadomości z normalnych czatów są odrzucane); `eveningExtraction` jest używane w prompcie refleksji; fast-path planowania przechodzi przez `validatePlanJson`; mismatch Pascal/lowercase nie psuje `calculateGoalAlignment` (PowerList zapisuje kategorie jako `cialo`/`duch`/`konto`).
- **Propozycje i wizje:** nowe funkcje, konsolidacje, „aplikacja z oczami”, tabele z 284 problemami.
- **Niezweryfikowane liczby:** dokładne 598× `any`, 1.1% coverage, 85× `console.log` — kierunek jest prawdziwy, ale liczby nie były ponownie przeliczone.

---

## 1. Oracle + bezpieczeństwo

### Potwierdzone — krytyczne

| ID | Problem | Dowód |
|----|---------|-------|
| **SEC1** | Brak weryfikacji tożsamości w Oracle — `user_id` z body requestu, bez `resolveUserScope()` | `vanguard-oracle/index.ts:60-62` |
| **SEC3** | `user_conf` wstrzykiwany do system promptu bez sanityzacji | `vanguard-oracle/index.ts:842` |
| **SEC4** | Ścieżka `save_link` bez autoryzacji (HTTP POST z URL) | `vanguard-telegram/index.ts:24-29` |
| **SEC2** | Brak weryfikacji `X-Telegram-Bot-Api-Secret-Token` | `vanguard-telegram/index.ts` — brak sprawdzenia nagłówka |
| **L1** | `deterministicTriads()` tworzy trwałe triady z regexów (np. słowo „maraton” → „Dwa maratony”, confidence ≥ 0.85) | `vanguard-architect/index.ts:55-483`, np. `:411-416` |
| **L7** | `state_vector` z klienta trafia do kontekstu LLM bez sanityzacji | `vanguard-oracle/index.ts:60, 811` |
| **L8** | Po błędzie `JSON.parse` odpowiedzią może być treść bloku `<think>` | `vanguard-oracle/index.ts:877-889` |
| **AI1** | Historia czatu Oracle nie jest persystowana — zamknięcie czyści `items` | `OracleCard.tsx:379` |
| **AI2** | `clarification_request` jest zapisywane do DB, ale Oracle nie czyta ich w kolejnych wywołaniach | zapis: `vanguard-oracle/index.ts:926-943`; brak odczytu w pliku |

### Potwierdzone — ważne

| ID | Problem | Dowód |
|----|---------|-------|
| **L3** | Anti-analysis guard przerywa wiadomości `stream` ≥ 120 znaków pytaniem o artefakt | `messages.ts:439-440`, `antiAnalysis.ts:19-39` |
| **L4** | `classifyIntentSafe()` opiera się na regexach; „Dlaczego znowu źle śpię?” trafia do `recent_pattern` (wzorzec `znowu` jest przed `sen`) | `vanguard-oracle/index.ts:44-50` |
| **SEC9** | CORS `Access-Control-Allow-Origin: *` na edge functions | `_shared/supabase.ts:81` |
| **DC1 / DL1** | `gatherUserContext()` używa `format(new Date(), 'yyyy-MM-dd')` bez strefy Warsaw | `aiContext.ts:22` |
| **DC4** | Ten sam brak auth co SEC1 — powtórzone w kontekście spójności danych | `vanguard-oracle/index.ts:60` |

### Częściowo prawdziwe

| ID | Uwaga |
|----|-------|
| **L6** | Średnie 14-dniowe są liczone z dostępnych dni; prompt podaje `oura_days_logged` / `nutrition_days_logged`, ale nie ostrzega wprost, że średnia z 3 dni ≠ pełne 14 dni |
| **L2** | System prompt Oracle jest bardzo długi — potwierdzony rozmiar, wpływ na „recency bias” modelu pozostaje interpretacją |

---

## 2. Analiza, strain, żywienie

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **A1** | Welch t-test liczy `df`, ale p-value z `normalCDF` (komentarz: „normal approx”) | `compute-behavior-effects/index.ts:33-34`, `compute-correlations/index.ts:33` |
| **A3** | `SIGMA = 1.253` w obliczeniach z-score | `compute-daily-strain/index.ts:392` |
| **A5** | `ewmaBaseline` filtruje `v != null` — `NaN` przechodzi | `compute-daily-strain/index.ts:29-31` (brak `Number.isFinite`) |
| **BNT1** | Kalorie dnia z `daily_nutrition`, makra z sumy `daily_food_entries` — mogą się rozjechać | `NutritionCard.tsx:218-219` vs `:225-236` |
| **BNT2** | `fueling_score` nie jest w `DailyStrainCard` (jest m.in. w `CockpitBanner`) | brak dopasowania w `DailyStrainCard.tsx` |
| **BNT3** | `proteinGoal: 160` hardcoded w `computeSignals()` | `_shared/vanguardCore.ts:73` |
| **BNT4** | Pasek białka w analizie posiłku: `(m.protein_g / 60) * 100` | `FoodAnalysisSection.tsx:203` |
| **DF3** | `readiness_signals` / `explanation` obliczane w backendzie, niewidoczne w `DailyStrainCard` | brak w komponencie |
| **DF4** | Jak BNT2 — `fueling_score` ukryty w głównej karcie strain |
| **KP1 / DF2** | `takeaways: []` zawsze; `deepseekChat` zaimportowany w `savedLinks.ts`, nieużywany do podsumowań | `savedLinks.ts:2, 162, 206` |

### Częściowo prawdziwe

| ID | Uwaga |
|----|-------|
| **A2** | `estMaintenance` uwzględnia średnią aktywność Oura; `addBack` dodaje nadwyżkę dzisiejszej aktywności ponad średnią — ryzyko zawyżenia celu, nie udowodniony błąd stały |

---

## 3. Telegram i prompty

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **T3** | Anti-drift directive w prompcie Oracle — kod/architektura mapowane na „ucieczkę przed napięciem” | `vanguard-oracle/index.ts:647-651` (sekcja anti-drift) |
| **T10** | Anti-analysis: `maxTokens: 10`, binarny YES/NO, tekst obcięty do 800 znaków | `antiAnalysis.ts:25-28` |
| **T6** | Voice > 120 słów → tryb `knowledge` zamiast `stream` | `messages.ts:356` |
| **T12** | Synthesis prompt w `saturdayCheckin` po angielsku/portugalsku w polskim systemie | `saturdayCheckin.ts:155-169` |
| **TB1** | Pusty/niepoprawny body webhooka → `req.json()` rzuca, catch zwraca błąd — ryzyko utraty wiadomości przy błędnym payloadzie | `vanguard-telegram/index.ts:20, 77-80` |
| **SEC5** | Transkrypcja głosu może trwać do ~60 s przy limicie webhooka Telegram ~30 s | `_shared/telegram.ts` (timeout) + architektura bez `waitUntil` w entry |

### Odrzucone z oryginału

| ID | Powód |
|----|-------|
| **T1** | `eveningExtraction` **jest** w prompcie refleksji (`reconciliation.ts:113`) |
| **T8** | Fast-path z historii i tak przechodzi `validatePlanJson` (`planning.ts:251-253`) |
| **TB2** | Przy braku `TELEGRAM_CHAT_ID` bot **nie** przyjmuje wszystkich czatów — odrzuca czaty z `id !== 0` |

---

## 4. Frontend i UX

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **F1 / SSO2** | `fetchUserSettings` zdefiniowany, nigdzie nie wywoływany | tylko definicja w `useStore.ts` |
| **F2** | `getDerivedStateFromError` wywołuje `window.location.reload()` przy ChunkLoadError — ryzyko pętli | `ErrorBoundary.tsx:17-21` |
| **F3** | `alert()` / `confirm()` w wielu komponentach mobilnych | m.in. `PowerList.tsx`, `Fundament.tsx`, `useSyncActions.ts`, `DesktopDashboard.tsx` |
| **F4 / PF2** | `gatherUserContext()` — ~20 równoległych zapytań Supabase bez cache | `aiContext.ts:30-60` + dodatkowe `getPersonalBaseline` / `determineState` |
| **F11 / PF1** | Dashboard montuje wszystkie 4 taby naraz (`hidden` CSS) | `Dashboard.tsx:326-413` |
| **F12** | `nowWarsaw()` buduje `Date` z części Warsaw jako pseudo-lokalny timestamp | `date.ts:55-66` |
| **F13 / MO8** | `URL.createObjectURL` w `OracleCard` bez `revokeObjectURL` | `OracleCard.tsx:469` |
| **MO2** | Input Oracle `text-[12px]` — ryzyko auto-zoom w Safari iOS | `OracleCard.tsx:503` |
| **SSO1** | `ScheduleView` tylko `localStorage`, bez `vanguard_calendar` | `ScheduleView.tsx:14-23` |
| **SSO3** | `Auth.tsx` — tylko `signInWithPassword`, brak rejestracji i resetu hasła | `Auth.tsx:27-28` |
| **SSO4** | `DemoOverlay` istnieje, nie jest importowany w aplikacji | tylko `DemoOverlay.tsx` |
| **DL2 / DC2 / SSO9** | Streak w `useUserStatsSnapshot` używa `toISOString().substring(0,10)` (UTC), nie Warsaw | `useUserStatsSnapshot.ts:72` |
| **UX2** | Tailwind `primary: '#3b82f6'` vs CSS `--primary: #4f46e5` | `tailwind.config.js:12`, `index.css:5` |
| **UX3** | Warianty `Card`: `glass`, `immersive`, `canvas`, `receipt` — hardcoded `bg-white` / `#0A0A0A` | `Card.tsx:19-48` |

### Częściowo prawdziwe

| ID | Uwaga |
|----|-------|
| **F14** | `BlockTimer` lazy-loadowany ale ukryty w Dashboard; `AgentSystemPromptHelper` jako komponent nie renderowany, ale `getOracleUserConf` jest używany w `OracleCard` |

---

## 5. System wiedzy (graf, wiki, vault)

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **K2** | `temporal_status: "historical"` ustawiane przy supersede w architect | `vanguard-architect/index.ts:705, 760` |
| **K3** | `get_vanguard_graph_context` nie filtruje po `temporal_status` | `20260512000000_graph_foundation.sql:69-72` |
| **K7** | Vault ingest wstawia triady bez `deprecateSupersededLinks` | `ingest-vault-log/index.ts:222-243` |
| **DP1** | Moduły `vanguardPatterns/*.ts` (6 detektorów) **nie są wywoływane** — potwierdzone komentarzem w kodzie | `_shared/vanguardPatterns.ts:20-23` |

### Częściowo prawdziwe

| ID | Uwaga |
|----|-------|
| **K1** | Pętla stream → friction → patterns → wiki jest architektonicznie możliwa; brak dowodu na skalę problemu w danych produkcyjnych |
| **DP1** | Osobna funkcja `vanguard-detect-patterns` ma **własne** inline detektory i jest wywoływana — nie jest to całkowity brak detekcji wzorców |

---

## 6. Integracje i sync

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **S1** | `sync-strava`: read refresh_token → refresh → upsert — przy równoległych wywołaniach Strava rotuje token i drugi refresh może być nieważny | `sync-strava/index.ts:36-75` |
| **S3** | `sync-oura-enhanced`: `!res.ok` → `{ data: [] }` (w tym 429) | `sync-oura-enhanced/index.ts:19-21` |
| **S5** | `parse-food-nl` odfiltrowuje produkty z `calories <= 0` | `parse-food-nl/index.ts:204` |
| **S8** | `parseLeadingGrams("1 sztuka (30g)")` zwraca `1` (pierwsza liczba w stringu) | `lookup-food/index.ts:85-90` |

### Częściowo prawdziwe

| ID | Uwaga |
|----|-------|
| **S2** | Sync Oura może zakończyć się sukcesem z 0 wierszami przy błędzie API — wymaga głębszej analizy każdej funkcji Oura osobno |

---

## 7. Baza danych

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **DB1** | Brak migracji DOWN w `supabase/migrations/` | brak plików rollback |
| **DB2** | Rdzeniowe tabele (`daily_wins`, `daily_strain`, `vanguard_stream` itd.) — brak `CREATE TABLE` w migracjach repo | wyszukiwanie w `supabase/migrations/` |
| **DB3** | Trzy migracje czerwca 2026 naprawiają overloady `match_vanguard_content`, `get_vanguard_graph_context`, `save_workout_atomic` | `20260622210000`, `20260622220000`, `20260622230000` |
| **DB5** | Pliki w `_pending_faza1/` mogą nie być zaaplikowane | katalog istnieje w repo |

---

## 8. Todo, projekty, cele

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **TG1** | `handleCreate`: `createProject` → `createTodoSection` → `linkSectionToProject` bez transakcji | `Projects.tsx:180-193` |
| **DF1 / P3** | `goal_kpi_snapshots` zapisywane przy KPI, nigdzie nie odczytywane w UI | `Projects.tsx:314`; brak odczytu w `src/` |
| **KP3** | Kategorie Pocket hardcoded | `LinksInbox.tsx` — stała lista kategorii |
| **KP8** | Klasa CSS `pocket-card` używana bez definicji w arkuszu stylów | `LinksInbox.tsx` + brak w CSS |

---

## 9. Jakość kodu i testy

### Potwierdzone

| ID | Problem | Dowód |
|----|---------|-------|
| **TQ1** | Tylko 2 pliki testowe: `date.test.ts`, `statsCalculations.test.ts` | `src/` |
| **TQ2** | CI nie uruchamia `npm run test` | `.github/workflows/ci.yml` — brak kroku test |
| **TQ3** | Duża liczba typów `any` w `src/` i `supabase/functions/` | rozsiane po kodzie (kierunek potwierdzony) |

---

## 10. Wzorce systemowe (potwierdzone obserwacje)

1. **Brak centralnego kontekstu użytkownika** — komponenty robią własne zapytania Supabase; `gatherUserContext` i `useDashboardData` się pokrywają.
2. **System wie więcej niż pokazuje** — `fueling_score`, `readiness_signals`, `goal_kpi_snapshots`, `takeaways`, detektory w `vanguardPatterns/*.ts` (niepodłączone).
3. **Silosy danych** — Schedule vs kalendarz, Pocket vs cele, Projects vs strain/recovery (brak kodu łączącego).
4. **Auth na edge functions** — Oracle i `save_link` opierają się na `user_id` z body, nie na tokenie sesji.
5. **Hardcoded progi** — m.in. `SIGMA=1.253`, `OURA_CORRECTION=0.88`, `proteinGoal=160`, saturacja strain `156`.

---

## Priorytety (tylko zweryfikowane)

### Natychmiast

1. Auth Oracle + sanityzacja `user_conf` / `state_vector` (SEC1, SEC3, L7)
2. Zabezpieczenie `save_link` i webhooka Telegram (SEC4, SEC2)
3. Race condition refresh tokena Strava (S1)
4. `fetchUserSettings` martwy — brak ustawień w UI (F1)
5. `ErrorBoundary` reload w `getDerivedStateFromError` (F2)

### Ten tydzień

6. `deterministicTriads` — fałszywe fakty z regexów (L1)
7. p-value z normalCDF zamiast t-rozkładu (A1)
8. `aiContext` — data bez Warsaw (DL1)
9. Historia Oracle tylko w RAM (AI1)
10. `handleCreate` bez transakcji (TG1)

---

## Statystyka po weryfikacji

| | Oryginał | Po weryfikacji |
|---|---------|----------------|
| Sekcje audytu | 37+ | 10 |
| Punkty problemów | ~284 (w tym duplikaty) | **~65 potwierdzonych** + kilka częściowych |
| Usunięte | — | propozycje funkcji, wizje, fałszywe twierdzenia, 6× zduplikowane podsumowania |

---

*Weryfikacja w kodzie: 2026-06-26*  
*Oryginalny raport: 2026-06-25 (diagnoza bez fixów)*
