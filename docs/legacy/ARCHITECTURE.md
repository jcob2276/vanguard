# Vanguard OS — Architecture Reference (LEGACY)

> **Do not implement from this file.** Current map: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), [`AGENTS.md`](../../AGENTS.md).

# Vanguard OS — Architecture Reference

## Co to jest

Vanguard OS to **Cyfrowy Bliźniak** jednego użytkownika (Jakuba). Nie jest to aplikacja
produktywności. Jest to system budujący coraz głębszy model człowieka — jego biologii,
zachowań cyfrowych, tożsamości i wzorców — i używający tego modelu do diagnostyki,
predykcji oraz prowadzenia rozmowy, która kopie głębiej niż użytkownik sam by sięgnął.

Rdzeń filozofii projektowej: **AI NIE LICZY. AI INTERPRETUJE.**
Cała matematyka (z-score, Pearson, cliff detection) jest deterministycznym kodem.
Do modelu trafia gotowy STATE_VECTOR — skompresowany obraz stanu. Model tylko interpretuje.

---

## Przepływ danych (wysoki poziom)

```
Źródła surowe → computeSignals() → VanguardCore → STATE_VECTOR → vanguard-oracle (AI)
     ↑                                    ↓
Supabase DB ←← save-daily-aggregate ←← WARM STORAGE (vanguard_daily_aggregates)
```

Dwa entry pointy do AI, jeden silnik:

```
AIInsight.jsx  (Mirror Mode — pasywny, ładuje się automatycznie)
     ↓
aiContext.js → vanguardCore.js → STATE_VECTOR → vanguard-oracle Edge Function
     ↑
MentorChat.jsx (Chat Mode — aktywny, użytkownik pisze)
```

Oba entry pointy budują **identyczny STATE_VECTOR** przez `aiContext.js`. Jedno źródło prawdy.

---

## Frontend — komponenty

| Komponent | Rola |
|---|---|
| `Dashboard.jsx` | Shell nawigacyjny. Zarządza widokiem (localStorage), ładuje `useDashboardData`, obsługuje Google OAuth callback |
| `AIInsight.jsx` | Mirror Mode. Wywołuje `fetchInsight()` przy ładowaniu. Buduje STATE_VECTOR i wywołuje `vanguard-oracle` z `mode: 'mirror'` |
| `MentorChat.jsx` | Chat Mode. Użytkownik pisze → `gatherUserContext()` → `vanguard-oracle`. Zapisuje historię do `ai_chat_messages` |
| `PowerList.jsx` | Edytor Power Listy (5 zadań z kategoriami ciało/duch/konto + wynik Z/P) |
| `Direction.jsx` | Grid 28 dni wyrównany do poniedziałków. Wizualizacja stanów i wyników |
| `Photos.jsx` | Porównywarka zdjęć (baseId/targetId — dowolne zestawienie, nie tylko chronologiczne) |
| `StayFreeDashboard.jsx` | Analityka ekranu z StayFree |
| `OuraWidget.jsx` | Wyświetlanie biometrii z Oura Ring |
| `Fundament.jsx` | Edytor tożsamości (filozofia, misja, filary) → `user_fundament` |
| `IntentionTracker.jsx` | Zarządzanie aktywnymi intencjami (slajdy, modlitwy, afirmacje, cele) → `vanguard_intentions` |
| `DataHub.jsx` | Centrum zarządzania danymi i synchronizacją |

---

## Silnik obliczeniowy — `src/lib/vanguardCore.js`

**Jedyne źródło prawdy dla całej matematyki systemu.**
Wcześniej istniały `signalAnalytics.js` i `stateEngine.js` — zostały usunięte.

### `computeSignals(stayfree, oura, todayWin)` — czysta funkcja

Wejście: surowe rekordy z trzech źródeł.
Wyjście: znormalizowane sygnały gotowe do klasyfikacji stanu.

- **Digital Exposure Vector**: `screen_time_min`, `fragmentation` (odblokowania / godzina realnego użycia), `dopamine_load` (udział apek społecznościowych × overlap × fragmentacja), `overlap_factor` (korekta na wielourządzeniowość — max urządzenie = czas realny)
- **Biological Vector**: `sleep`, `hrv`, `rhr`, `readiness` — bezpośrednio z Oura
- **Execution Vector**: `execution_ratio` = zadania zrobione / 5
- **Confidence**: osobny obiekt `{ digital, biometrics, execution, is_stale }` — Oracle wie jak ufać każdemu sygnałowi

Dlaczego funkcja czysta: żeby dało się ją wywołać w dowolnym miejscu bez side-effectów i testować izolowanie.

### `VanguardCore` — klasa

**`getPersonalBaseline()`**
Pobiera 90 dni z `vanguard_daily_aggregates`. Oblicza `mean + stdDev` per metryka (sen, HRV, fragmentacja, dopamina, czas ekranu, egzekucja). Jeśli < 5 dni danych — tryb `CALIBRATING` z bezpiecznymi domyślnymi. Minimalny stdDev jest clampowany (sen min 0.3h, HRV min 3ms) żeby uniknąć dzielenia przez zero w z-score.

**`determineState(currentSignals, baseline)`**
Klasyfikuje bieżący dzień do 7 stanów używając z-score względem personalnego baseline:

```
LOCKED_IN   — exec = 1.0 AND biologicalScore >= 0
MOMENTUM    — exec >= 0.8
RECOVERY    — biologicalScore < -1.0 AND exec < 0.2
CHAOS       — biologicalScore < -2.0 AND exec < 0.4
AVOIDANCE   — biologicalScore >= -0.5 AND exec < 0.4
CONSUMING   — digitalScore < -1.5 (cyfrowa dominacja)
CALIBRATING — < 5 dni historii
STALE_DATA  — dane Oura starsze niż dziś
```

Fragmentacja i dopamina mają odwrócony znak w z-score (`-zScore`), bo wyższe = gorsze.

**`calculateGoalAlignment(todayWin)`**
Mapuje wykonane zadania na kategorie `ciało/duch/konto`. `alignment_score` = pokryte kategorie / 3 × 100. `drift_score` = 1 - (pokryte kategorie / 3). Wykrywa które obszary fundamentu są ignorowane dziś.

**`computePredictions(current, history, baseline)`**
Hybrydowy silnik predykcji:
1. **Cliff Detection** — progi absolutne (sen < 5.5h → CRITICAL_SLEEP_DEBT, dopamina > 1.8 → DOPAMINE_OVERLOAD_CLIFF)
2. **Synergy Engine** — interakcje sygnałów (niski sen + wysoka dopamina → risk × 1.5)
3. **Momentum** — trend 7-dniowy egzekucji
4. **Pearson modulated by Ontology** — czyta `vanguard_correlations` (wypełnianą przez `refresh-vanguard-correlations`). ONTOLOGY definiuje "kierunek destrukcyjny" per sygnał (`sleep: 'lower'`, `fragmentation: 'higher'`) żeby uniknąć odwróconego znaku przy ocenie ryzyka

**`detectLagCorrelations(history)`**
2 hardkodowane wzorce temporalne:
- `SLEEP_DEBT_ECHO`: sen sprzed 48h < 6h + dzisiejsza dopamina > 1.2
- `FOCUS_DEBT`: wczorajsza fragmentacja > 1.5 + dzisiejsza egzekucja < 0.4

**`evaluateIdentityVault()`**
Pobiera `user_fundament` (filozofia, misja, filary), dzisiejszy journal/nastrój z `daily_wins`, today's aggregate, oraz top 3 wpisy z `vanguard_knowledge` według `importance_score`. Używane w STATE_VECTOR jako kontekst tożsamościowy.

**`analyzeInterventions()`**
Śledzi interwencje oznaczone w `daily_wins` (flag `is_intervention`). Gdy HRV wzrośnie > 3ms lub sen > 0.5h w ciągu 3 dni od interwencji — tworzy `vanguard_temporal_links` z `strength` proporcjonalną do delty. To jest mechanizm feedback loop: system uczy się co faktycznie działa.

---

## Bridge — `src/lib/aiContext.js`

`gatherUserContext(session)` buduje kompletny STATE_VECTOR i zwraca go bezpośrednio (nie jako string — MentorChat przekazuje obiekt do Oracle).

8 równoległych zapytań przy każdym wywołaniu:
- `stayfree_usage` (dziś)
- `oura_daily_summary` (ostatni)
- `daily_wins` (dziś)
- `vanguard_daily_aggregates` (cała historia — dla baseline i lag correlations)
- `weekly_reviews` (bieżący tydzień, poprzedni, ostatni)
- `vanguard_footprint` (ostatnie 20 wpisów — aktywność desktopowa live)

Buduje STATE_VECTOR zawierający: `state`, `confidence`, `now`, `metrics` (biological + digital), `lag_correlations`, `predictions`, `goal_alignment`, `identity_vault`, `weekly_protocol`, `active_signature`, `desktop_footprint`.

---

## AI Oracle — `supabase/functions/vanguard-oracle/index.ts`

Model: **DeepSeek V4** (flash lub pro — pro gdy `thinking: true`). Temperature 0.7.

### Dwie warstwy kontekstu

**STATIC** (ładowany za każdym razem, kandydat do cache):
- `user_fundament` — tożsamość, filozofia, wizja
- `vanguard_knowledge` (importance ≥ 8) — "żelazne zasady"
- `vanguard_knowledge` (category = 'pattern') — powtarzające się wzorce z licznikiem
- `vanguard_knowledge` (category = 'person') — znane osoby (żeby wykryć nowe)
- `vanguard_intentions` (status = 'active') — aktywne intencje, slajdy, modlitwy

**DYNAMIC** (per zapytanie, wymaga embeddingu):
Gdy jest `current_query`:
1. Generuje embedding przez `text-embedding-3-small` (OpenAI)
2. Wywołuje `match_vanguard_content` (RPC z pgvector) — semantic search z threshold 0.35, top 15
3. Ładuje rozszerzony kontekst: timeline 7 dni, nastroje, żywienie (ogólne + szczegółowe posiłki), ćwiczenia (serie + RPE), StayFree (3 dni), kalendarz, footprint desktopowy (200 wpisów), myśli ze strumienia, nawyki 14 dni, Power Lista 30 dni, metryki ciała

**Footprint filtrowanie prywatności**: Tytuły okien zawierające słowa kluczowe (banki, hasła, medycyna, prawo, komunikacja prywatna) są zastępowane `[UKRYTO ZE WZGLĘDÓW PRYWATNOŚCI]`. Nazwa aplikacji pozostaje.

**Tryb `mirror`**: System prompt zmienia się — zakaz pytań bezpośrednich, tylko obserwacje i pytania retoryczne. Oracle nie odpyta Jakuba, tylko mówi co widzi.

### Persona Oracle (system prompt)

"Cyfrowy Bliźniak Jakuba". Nie asystent, nie coach — zewnętrzny umysł budujący model człowieka. Zainteresowania: ciało i biologia, umysł i tożsamość, relacje, seksualność, pieniądze, wartości, cień i sabotaż, Reality Transurfing (Zeland). Styl: 1-2 zdania obserwacji + jedno pytanie, które kopie głębiej. Maksymalnie 5 zdań + pytanie.

### Conversational Memory Loop (fire & forget)

Po każdej odpowiedzi Oracle, w `EdgeRuntime.waitUntil()` (nie blokuje response), odpala `deepseek-v4-flash` z promptem ekstraktora. Wyciąga max 3 spostrzeżenia z rozmowy — osoby, wzorce, emocje, lekcje — i zapisuje do `vanguard_knowledge`. To jest mechanizm samouczący się: każda rozmowa buduje bazę wiedzy o użytkowniku.

---

## Edge Functions — pozostałe

| Funkcja | Rola |
|---|---|
| `save-daily-aggregate` | Oblicza i zapisuje dzienny snapshot do `vanguard_daily_aggregates`. Wywołuje się raz dziennie (ręcznie lub przez cron). Bez tego baseline nie rośnie. |
| `refresh-vanguard-correlations` | Pearson (x: sygnał[t], y: execution_score[t+lag]) dla 3 sygnałów × 2 lagi. Wymaga min 20 dni. Zapisuje do `vanguard_correlations`. Wywołuje się rzadziej (tygodniowo). |
| `sync-oura` | Ściąga dane z Oura API → `oura_daily_summary` |
| `sync-yazio` | Ściąga dane żywieniowe → `daily_nutrition`, `daily_food_entries` |
| `sync-calendar` | Google Calendar OAuth → `vanguard_calendar` |
| `vanguard-telegram` | Bot Telegram do szybkich wpisów do strumienia myśli |
| `weekly-report`, `daily-reminder` | Powiadomienia push/email |

---

## Baza danych — tabele

### Behavioral Core (WARM Storage)

| Tabela | Zawartość | Dlaczego istnieje |
|---|---|---|
| `vanguard_daily_aggregates` | Dzienny snapshot: egzekucja, biometria, digital, stan, identity_score | Baseline i Pearson wymagają serii historycznej. Bez tej tabeli system działa w trybie CALIBRATING. |
| `vanguard_correlations` | Współczynniki Pearsona (signal_name, lag_days, r_value) | Cache korelacji — kosztowne obliczenie, używane przy każdej predykcji |
| `vanguard_temporal_links` | Interwencja → skutek (source_date, target_date, strength) | Feedback loop: system uczy się które interwencje działają |
| `vanguard_footprint` | Desktop activity z ActivityWatch (app, window title, timestamp) | Live context dla Oracle — Oracle widzi co Jakub robi w tej chwili |
| `vanguard_stream` | Strumień myśli / notatki głosowe | Surowiec do semantic search |
| `vanguard_knowledge` | Semantyczna baza wiedzy (wzorce, osoby, lekcje, żelazne zasady) | Pamięć długoterminowa systemu. Rośnie przez Memory Loop po każdej rozmowie. |
| `vanguard_identity` | Misja długoterminowa, filary, triggery unikania | Statyczny profil tożsamości — ładowany do każdego promptu |
| `vanguard_intentions` | Aktywne intencje (slajdy/modlitwy/afirmacje/cele) | Oracle operuje w języku Reality Transurfing — to jego kontekst |
| `vanguard_habits`, `vanguard_habit_logs` | Definicje nawyków + logi 14 dni | Dyscyplina codzienna widoczna dla Oracle |

### Biometria i dane zewnętrzne

| Tabela | Źródło |
|---|---|
| `oura_daily_summary` | Oura Ring (HRV, sen, readiness, temperatura) |
| `stayfree_usage` | StayFree Android (app, duration_seconds, unlocks per device) |
| `daily_wins` | Power Lista (5 zadań × kategoria × done, wynik Z/P, journal, nastrój) |
| `daily_nutrition`, `daily_food_entries` | Yazio (makra + posiłki szczegółowe) |
| `exercise_logs` | Ćwiczenia (serie, ciężar, RPE) |
| `body_metrics` | Waga, body fat |
| `vanguard_calendar` | Google Calendar |
| `weekly_reviews` | Tygodniowe podsumowania (z czego dumny, sabotaż, co zrobić inaczej) |
| `user_fundament` | Filozofia, misja, tożsamość — edytowana przez `Fundament.jsx` |
| `ai_chat_messages` | Historia rozmów z Oracle (role: user/assistant) |

Wszystkie tabele mają RLS (`auth.uid() = user_id`).

---

## Kluczowe decyzje architektoniczne

**Jeden silnik obliczeniowy (`vanguardCore.js`)**
Poprzednia architektura miała trzy równoległe implementacje (signalAnalytics, stateEngine, vanguardCore). Każda liczyła stan inaczej, Oracle dostawał sprzeczne diagnozy. Wszystkie zostały usunięte na rzecz jednego pliku.

**STATE_VECTOR zamiast tekstu do AI**
Oracle nie dostaje narracji — dostaje skompresowany JSON z obliczonymi z-score, predykcjami i flagami. Eliminuje halucynację liczb przez AI. AI interpretuje, nie liczy.

**Dwa tryby tego samego Oracle**
Mirror Mode i Chat Mode to ten sam Edge Function, różni je pole `mode`. Mirror Mode wyłącza wszystkie pytania bezpośrednie i trigger osobowy — Oracle mówi, nie pyta.

**Semantic search per zapytanie, nie per render**
Embedding generuje się tylko gdy jest `current_query`. Mirror Mode nie generuje embeddingu — za drogo i niepotrzebnie. Statyczny kontekst (fundament, żelazne zasady) ładuje się zawsze — to kandydat do promptu systemowego z cache'owaniem.

**Memory Loop jako fire-and-forget**
Ekstrakcja wiedzy z rozmowy działa asynchronicznie (`EdgeRuntime.waitUntil`). Użytkownik dostaje odpowiedź natychmiast. Baza wiedzy rośnie w tle. Każda rozmowa to zapis do długoterminowej pamięci systemu.

**`vanguard_daily_aggregates` jako WARM Storage**
Baseline wymaga historii. Computacja in-line z 90 dni surowych danych byłaby niemożliwa per request. Dzienny snapshot (obliczany przez `save-daily-aggregate`) redukuje to do jednego prostego selecta.

**Pearson przez oddzielną Edge Function**
Korelacje Pearsonowskie są kosztowne i nie muszą być świeże w czasie rzeczywistym. `refresh-vanguard-correlations` uruchamia się raz w tygodniu, wyniki trafiają do cache (`vanguard_correlations`). `computePredictions` tylko odczytuje — zero obliczeń na hot path.
