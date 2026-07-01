# Plan: Własny Recovery/Readiness/Strain engine (inspirowany Noop/Strand)

> **Status dokumentu:** PLAN — etap 0 (planowanie zakończone, implementacja nie rozpoczęta).
> **Dla AI agentów:** ten plik jest źródłem prawdy o tym co budujemy i na jakim etapie jesteśmy. Aktualizuj sekcję "Etap obecny" po każdym zaimplementowanym kroku. Nie zaczynaj kodować bez przeczytania całości.

## 1. Cel

Oura/WHOOP liczą `readiness_score`/`sleep_score` jako czarną skrzynkę, skalibrowaną na **populacji**, bez kontekstu który Jakub ma w Vanguard (jedzenie, kofeina z dokładnym timingiem, kalendarz pracy, subiektywne samopoczucie). Cel: **nie ufać tej gotowej liczbie** — przeliczyć surowe metryki (HRV, RHR, sleep efficiency, temp deviation), które Oura i tak udostępnia w API, przez własny model, dopasowany do jednej osoby (Jakub, 168cm/73kg) i jej kontekstu.

To NIE jest próba pobicia dokładności sensora Oury (nie przetwarzamy raw PPG, nie mamy do niego dostępu). To jest **druga warstwa interpretacji** nad ich już-przetworzonymi danymi dziennymi, wzbogacona o sygnały, których Oura nigdy nie zobaczy.

### Sanity check celu (zrobiony)
- **Legalność:** repo źródłowe (Noop/Strand, `C:\Users\jakub\Desktop\woooop`) jest na licencji PolyForm Noncommercial 1.0.0 — dozwolone czytanie/forkowanie do użytku niekomercyjnego. Vanguard jest prywatnym, niekomercyjnym systemem Jakuba. Czysto.
- **Realizm:** algorytmy to opublikowana nauka (Edwards TRIMP, Karvonen 1957, Tanaka 2001, Nes 2011, Task Force 1996 HRV) — nie black-box, nie magia. Przepisywalne 1:1.
- **Granica oczekiwań:** na starcie (pierwsze 2-4 tygodnie) nasz score będzie **mniej** skalibrowany niż Oura, bo brak historii. Wartość rośnie z czasem (dose-response wymaga ≥12 dni do confidence "Solid").

## 2. Źródło

Repo `https://noop.fans/NoopApp/noop.git`, sklonowane lokalnie do `C:\Users\jakub\Desktop\woooop`. Kluczowe katalogi:
- `Packages/StrandAnalytics/Sources/StrandAnalytics/*.swift` — 18 algorytmów core (pure functions, zero CoreData/HealthKit).
- `android/analytics/*.kt` — 38+ dodatkowych algorytmów, część bogatsza niż wersja Swift (np. DoseResponseEngine).
- `docs/ANALYTICS.md`, `docs/FITNESS_AGE.md` — specyfikacje formuł.

## 3. Dane już dostępne w Vanguard (nie trzeba niczego nowego synchronizować)

| Tabela | Kolumny istotne |
|---|---|
| `oura_daily_summary` | `hrv_avg`, `rhr_avg`, `readiness_score` (referencyjny, nie używany jako input do naszego score), `sleep_*` |
| `oura_enhanced` | `deep_sleep_hours`, `light_sleep_hours`, `rem_sleep_hours`, `sleep_efficiency`, `sleep_latency_minutes`, `temp_deviation`, `activity_score`, `breathing_disturbance_index` |
| `oura_heartrate` | Wysokorozdzielczy HR (ts, bpm) przez cały dzień — **rolling 14-dniowy window (prune w `sync-oura-timeseries`)**, nie pełna historia. Wystarcza do liczenia `StrainScorer` na bieżąco |
| `oura_sleep_hr_timeline`, `oura_sleep_hrv_timeline` | HR/HRV co 5 min per sesja snu |
| `oura_sleep_phase_timeline` | Realny hypnogram (deep/light/rem/awake) co 5 min — staging już zrobiony przez Oura, nie trzeba własnego SleepStager |
| `oura_workouts` | ~~Treningi wykryte przez sam Oura~~ — **ODRZUCONE** (4.17): mamy lepszy własny log w `workout_sessions`/`exercise_logs` |
| `oura_sessions` | ~~Meditation/breathing~~ — **ODRZUCONE** (4.17): nieużywane, Jakub nie medytuje |
| `workout_sessions`/`exercise_logs` | start_time, end_time, sets, reps, weight, rpe, rir, muscle_tags — **źródło prawdy o treningu**, do parowania z `oura_heartrate` per sesja (4.17) |
| `daily_strain` | `strain_score`, `cns_load`, `strength_load`, `leg_load`, `recovery_score` (własny, inny silnik niż ten plan — do zintegrowania/zastąpienia później, TBD) |
| `exercise_logs` | `sets`, `reps`, `weight`, `rpe`, `rir`, `muscle_tags` — do StrainScorer jeśli liczymy strain z treningu siłowego, nie tylko HR |
| `body_composition_measurements` | prawdziwy `body_fat_pct`, `weight_kg` — nie zgadywany jak konkurencja |
| `nutrition_profile`/`daily_food_entries` | timing/dawka kofeiny (do CaffeineDecay), kalorie/białko |
| `dailyPlan.ts` / `DayPlanCard.tsx` | `energy_level` — subiektywny check-in, **ground truth do kalibracji**, nie input do score'u |

### Brakujący element infrastruktury
**`behavior_log`** (data, behavior_key, wartość/yes-no, notatka) — wymagany dla: confounder suppression w Illness Engine, Behavior Insights ("What Moves You"), Dose-Response. **To jest blocker dla etapów 4-5 poniżej.**

**Ważna korekta:** sauna NIE potrzebuje nowej tabeli — już jest logowana jako wiersz w `exercise_logs` (`exercise_name = "Sauna"`, `reps` = minuty — przeładowane pole z `WorkoutLogger.tsx`/`ActivityCard.tsx`, `weight=0`, `muscle_tags=[]`, przypisana do `workout_sessions.date`). Przy confounder suppression w Illness Engine (4.4) i Behavior Insights (4.6) zapytanie o sygnał "sauna danego dnia" to:
```sql
EXISTS (
  SELECT 1 FROM exercise_logs el
  JOIN workout_sessions ws ON ws.id = el.session_id
  WHERE ws.date = :day AND el.exercise_name ILIKE 'sauna%'
)
```
`behavior_log` jest potrzebny tylko dla rzeczy, które **nigdzie jeszcze nie istnieją** w schemacie: alkohol, podróż, stres, choroba. Przed Etapem 1 sprawdzić czy podobny wzorzec (wolne pole tekstowe w istniejącej tabeli) nie pokrywa też innych behaviorów — nie duplikować loggingu.

## 4. Algorytmy do implementacji — dokładne wzory

(Pełna kopia w pamięci agenta: `project_noop_algorithms.md`, ale kanoniczna wersja ma być TU, w repo, żeby przetrwała między sesjami niezależnie od pamięci AI.)

### 4.1 Baselines (EWMA + Winsorized z-score) — FUNDAMENT, budować jako pierwszy
```
λ = 1 - 0.5^(1/half_life)
baseline_new = λ·clamp(value, baseline±3·spread) + (1-λ)·baseline_old
spread_new = max(floor, λ_s·|value-baseline_new| + (1-λ_s)·spread_old)
z = (value - baseline) / (1.253 · spread)
```
Half-life: 14 dni (baseline) / 21 dni (spread). Per metryka: HRV (floor spread 5.0), RHR (floor 2.0), resp (floor 0.5), skin_temp (floor 0.3). Min nights seed = 4, trust = 14, stale = 14 dni.

### 4.2 Recovery/Charge → `vanguard_readiness`
```
z_composite = Σ(z_i · w_i) / Σ(w_i)
score = 100 / (1 + exp(-1.6 · (z_composite + 0.20)))
```
Wagi: HRV 0.55, RHR 0.20, sen 0.15, respiracja 0.05, skin temp 0.05. Sleep performance term: `z_sleep = (sleep_efficiency - 0.85) / 0.12`. Bandy: Red <34, Yellow 34-67, Green >67. Cold-start fallback: populationMean = 58.0 gdy baseline niezdatny.

### 4.3 Strain
```
strain = 100 · ln(TRIMP + 1) / ln(7201)
```
Edwards 5-zone TRIMP (%HRR via Karvonen): 90%→5, 80%→4, 70%→3, 60%→2, 50%→1. HRmax = Tanaka: `208 - 0.7·age`. Uwaga: Vanguard ma już `daily_strain.strain_score` z innego silnika (treningowego, sets/reps/RPE-based) — **decyzja do podjęcia w etapie 3**: czy ten HR-based strain ZASTĘPUJE istniejący, czy żyje jako drugi, równoległy sygnał (np. "cardio strain" vs "mechanical strain").

### 4.4 Illness Signal Engine (z confounder suppression)
```
raw_score = Σ min(40, 22·max(0, z_i - 2.0))   // RHR↑, temp↑, HRV↓, resp↑
score = min(100, raw_score)
if confounder_present (z behavior_log): score *= 0.45
```
Levels: quiet <25 lub <2 sygnały, mild 25-50, raised ≥50 (bez confoundera), suppressed ≥25 (z confounderem). Wymaga `behavior_log`.

### 4.5 Dose-Response Engine (Bayesian shrinkage, wersja Android — bogatsza)
```
β_user = OLS slope(dose, outcome_next_day)
w = n_user / (n_user + 8)
β_final = clamp(w·β_user + (1-w)·β_prior, prior.clampLow, prior.clampHigh)
```
Confidence: n<5 Calibrating, 5-11 Building, n≥12 Solid. Pairing: dose dzień D ↔ outcome dzień D+1. Wymaga `behavior_log`.

### 4.6 Correlation/Behavior Insights ("What Moves You")
```
Pearson r = Σ(x-x̄)(y-ȳ) / √(Σ(x-x̄)²·Σ(y-ȳ)²)
Cohen's d = (m1-m2) / pooled_SD
Welch t-test → p-value
```
Significant gdy p<0.05 i min(n1,n2)≥5. Wymaga `behavior_log`.

### 4.7 DayOwnerResolver — rozstrzyganie dnia (KRYTYCZNE dla timezone)
Problem: noc kończąca się 08:00 lokalnego czasu (Europe/Warsaw) to inny dzień UTC w zależności od sezonu (CET=+3600s, CEST=+7200s). Strand rozwiązuje to funkcją `dayString(ts, offsetSec)`: przesuwa timestamp o offset, potem formatuje na `yyyy-MM-dd`. **Bez tego mechanizmu noce będą przypisywane do złego dnia w bazie.** Sprawdzić, czy istniejący kod Vanguard (`(now() AT TIME ZONE 'Europe/Warsaw')::date`, patrz pamięć `feedback_postgres_timezone`) już to pokrywa — prawdopodobnie tak na poziomie SQL, ale warto zweryfikować dla danych Oura specyficznie (sleep session kończąca się rano powinna trafić do dnia, w którym się kończy, nie zaczyna).

### 4.8 ScoreConfidence — dokładne thresholdy (nie tylko nazwy stanów)
```
Charge:  calibrating gdy recovery==null OR baseline niezdatny
         building    gdy baseline tylko prowizoryczny
         solid       gdy baseline w pełni zaufany (≥14 nocy, patrz 4.1)
Effort:  solid wymaga ≥3600 próbek HR (~1h przy 1Hz) — NIEDOSTĘPNE z agregatów Oura, do zweryfikowania czy Oura API daje per-sekundowy HR czy tylko nocne agregaty
Rest:    calibrating brak sesji, building sesja bez stagingu, solid deep+REM obecne
         dodatkowy guard: jeśli efficiency≥0.85 ale deep+REM<10% czasu snu → downgrade solid→building (prawdopodobny błąd stagingu, nie realna noc)
```

### 4.9 ReadinessEngine — kontekst obciążenia (inny mechanizm niż 4.2 RecoveryScorer)
RecoveryScorer daje jedną liczbę 0-100. ReadinessEngine daje kontekst wielowymiarowy (good/watch/bad per sygnał) + trening:
```
ACWR (Acute:Chronic Workload Ratio) = mean(7-day strain) / mean(28-day strain)
  <0.8 watch, 0.8-1.3 good (sweet spot), 1.3-1.5 watch, ≥1.5 bad (ryzyko urazu)
Training Monotony (Foster) = mean(7-day strain) / sd(7-day strain)
  ≥2.0 watch (mała różnorodność = ryzyko choroby/przetrenowania)
```
Wymaga 28+ dni historii strain — niski priorytet na start, ale wartościowy długoterminowo jako "drugi głos" obok recovery score.

### 4.10 RecoveryForecast — wieczorna prognoza na jutro
```
forecast = center + adj_strain + adj_sleep + adj_reversion, clamp [0,100]
center = mean(Charge, ostatnie 14 dni)
adj_strain = clamp(-9.0 · (today_effort - mean_effort)/12.0, -12, 12)
adj_sleep = clamp(14.0 · clamp(planned_sleep/need_sleep - 1.0, -1.0, 0.25), -3.5, ...)
adj_reversion = clamp(-1.0 · slope(ostatnie 14 dni Charge), -8, 8)
band = max(SD(14d Charge), 8.0); jeśli nights<10: band += 6.0
```
Confidence: solid gdy ≥10 nocy historii, inaczej building. To jest fundament pod "evening damage forecast" wspomniany wcześniej — w wersji bez behavior_log liczy tylko ze strain+sleep+trend, nie z konkretnych zachowań (alkohol/kofeina) dopóki Etap 1 nie jest zrobiony.

### 4.11 WeeklyDigest — dokładna specyfikacja
5 metryk headline: charge, effort, rest, rhr, hrv. Typical spread (do normalizacji ruchu tydzień-do-tygodnia): charge/effort/rest=12pkt, rhr=4bpm, hrv=8ms. Baseline = średnia z 4 tygodni PRZED zeszłym tygodniem (nie liczy się zeszły/ten tydzień). Focus threshold = 0.5×spread. Balance read (Effort vs Charge): >+10 overreaching, [-10,10] balanced, <-10 underloaded. Output: top mover + supporting line w plain English ("Charge is up 5 pts (avg 75 vs 70) — a good sign").

### 4.12 ComparisonEngine / RangeReport — porównania okresów + trendy
`SeriesStat` (mean/median/min/max/stdev/n/slopePerDay przez OLS) + `PeriodComparison` (delta, %change, direction). RangeReport dodaje trend-slope thresholdy per metryka do klasyfikacji "flat/rising/falling" (np. recovery: 0.5pkt/dzień, hrv: 0.4ms/dzień). Przydatne pod "Compare two periods" z UX listy.

### 4.13 VitalityEngine — Body Age / Vitality score (NOWY, nie był wcześniej w planie)
Model Gompertza (mortality-rate doubling ~8 lat): `lnHazardPerYear = ln(2)/8 ≈ 0.0866`. Per-czynnik log-hazard (RHR, HRV vs norma wiekowa, sen, regularność snu, kroki, VO2max) sumowane × `overlapShrink=0.75`, konwertowane na `deltaAge = sumLn/lnHazardPerYear`, `bodyAge = clamp(age+deltaAge, 20, 90)`, `vitality = clamp(50 + (age-bodyAge)·2.5, 0, 100)`. Wymaga ≥3 czynników (minFactors). Z danych Oura dostępne: RHR, HRV, sen, regularność snu — VO2max i kroki trzeba pominąć albo dorzucić z innego źródła. Ciekawy, motywujący composite score, ale **niski priorytet** — nie blokuje żadnego innego etapu.

### 4.14 DoseResponsePriors — konkretne wartości populacyjne (uzupełnienie 4.5)
Przykładowe priory z kodu źródłowego (do potwierdzenia/skalibrowania na własnych danych z czasem):
```
alkohol → Charge:   slopePerUnit = -5.0 pkt/drink, clamp [-15, +2]
kofeina (timing) → HRV: slopePerUnit = -4.0 ms/krok-timingu-później, clamp [-20, +4]
```
To są tylko 2 przykładowe priory w źródle — reszta behaviorów w `behavior_log` (sauna, podróż, stres) nie ma gotowego priora w Strand, więc dla nich `DoseResponseEngine` startuje bez priora (pure user OLS, większa niepewność na początku).

### 4.15 KOREKTA: Oura DAJE wysokorozdzielczy HR — wcześniejszy werdykt "odrzucone" był błędny

**Sprawdzone w realnym kodzie** (`supabase/functions/sync-oura-timeseries/index.ts`), nie zgadywane: Vanguard już synchronizuje z Oura API znacznie więcej niż nocne agregaty:

| Endpoint Oura | Tabela Vanguard | Co zawiera |
|---|---|---|
| `/v2/usercollection/heartrate` | `oura_heartrate` (user_id, ts, bpm, source) | Wysokorozdzielczy HR przez cały dzień, nie tylko sen. **Pruned po 14 dniach** — rolling window, nie pełna historia |
| `/v2/usercollection/sleep` → `heart_rate`/`hrv` pola | `oura_sleep_hr_timeline`, `oura_sleep_hrv_timeline` | Punkty co 5 min (interval z API) per sesja snu |
| `/v2/usercollection/sleep` → `sleep_phase_5_min` | `oura_sleep_phase_timeline` | Realny hypnogram (deep/light/rem/awake) co 5 min — to JEST staging, SleepStager z 4.x nie jest potrzebny, Oura już to robi |
| `/v2/usercollection/workout` | `oura_workouts` (activity, intensity, calories, distance, start/end) | Oura ma własną detekcję treningu — `WorkoutDetector`/`AutoWorkoutDetector` (4.15 stara wersja) **niepotrzebne, Oura to już robi lepiej** (ich sprzęt, ich kalibracja) |
| `/v2/usercollection/session` | `oura_sessions` (avg_heart_rate, avg_hrv, mood, motion_count) | Meditation/breathing sessions z HR/HRV |

**Konsekwencje dla wcześniejszych werdyktów:**
- **`StrainScorer` (4.3) JEST odzyskiwalny** — `oura_heartrate` daje wystarczające dane do TRIMP/Edwards-zone (5-min interval, nie 1Hz, ale wystarczy do %HRR per okno czasowe). **Ograniczenie: tylko 14 dni rolling window** (prune w kodzie) — strain musi być liczony i zapisywany na bieżąco (codziennie po sync), nie retroaktywnie z głębszej historii.
- **`WorkoutDetector`/`AutoWorkoutDetector` NIE są potrzebne** — nie dlatego, że Oura nie daje danych (daje), ale dlatego, że Oura ma własną, sprzętowo skalibrowaną detekcję (`oura_workouts`). Budowanie własnej drugiej detekcji nad ich już-przetworzonym HR byłoby pracą bez zwrotu — używamy ich wyniku.
- **Sleep staging** (4.x SleepStager) **niepotrzebny** — `oura_sleep_phase_timeline` to już prawdziwy hypnogram z urządzenia.
- **`StressOnsetDetector`/`SpotHrvReading`** — wciąż NIEISTOTNE, bo wymagają live R-R buffer w czasie rzeczywistym (interaktywny pomiar na żądanie), nie historycznego strumienia. To się nie zmienia.
- **`StepsEstimateEngine`** — wciąż NIEISTOTNE, Oura daje już dzienny step count.
- **`MetricArbitrationPolicy`/`FusionResolver`** — wciąż NIEISTOTNE przy jednym źródle (Oura).

**Nowy punkt do zrobienia:** `StrainScorer` z `oura_heartrate` powinien wejść do Etapu 3 (razem z `RecoveryScorer`), nie być odkładany — dane już są synchronizowane, brakuje tylko przeliczenia. Trzeba też rozstrzygnąć (patrz Otwarte decyzje #6 poniżej) relację między tym HR-based strain a istniejącym `daily_strain.strain_score` (trening-based, sets/reps/RPE).

### 4.17 KOREKTA #2: `oura_workouts`/`oura_sessions` odrzucone — mamy lepsze własne dane

Jakub ma własny, dokładniejszy log treningowy (`workout_sessions`/`exercise_logs`: sets, reps, weight, RPE, RIR, muscle_tags, start_time, end_time) i nie medytuje. Czyli:
- `oura_workouts` (detekcja treningu przez sam Oura) — **odrzucone**, nadpisane przez własny log.
- `oura_sessions` (meditation/breathing) — **odrzucone**, nieużywane.

To otwiera lepszą architekturę: **łączenie własnego zalogowanego treningu z surowym HR z Oury**, zamiast polegania na detekcji (własnej czy Oury). Strand ma na to gotowy, przenośny mechanizm:

**`ManualWorkoutRescore.scored(windowSamples, profile, hrMax) → Scored(avgHr, maxHr, strain, kcal)`**
- Wejście: HR samples wycięte z okna `[startTs, endTs]` zalogowanego treningu (NIE auto-detekcja).
- Wewnątrz: `StrainScorer.strain(hr: windowSamples, ...)` (formuła 4.3, Edwards TRIMP/Karvonen %HRR) + `Calories.estimateBoutCalories()` (Harris-Benedict resting + Keytel 2005 active, próg aktywności `restingHR + 0.30×HRR`).
- Orkiestracja: `IntelligenceEngine.rescoreManualWorkouts()` — po każdym sync, dla treningów `source=="manual"`, wycina HR z `hrSamples(from: startTs, to: endTs)`, przelicza, zapisuje tylko jeśli wynik faktycznie lepszy niż obecny (`looksUnderScored`/`improves` gate — nie nadpisuje na gorsze/szumowe wartości).

**Plan dla Vanguard:** dla każdej `workout_sessions` (ma `start_time`/`end_time`) wyciąć `oura_heartrate` z tego okna czasowego → policzyć realny `StrainScorer` per sesja, zamiast generycznego dziennego strain. To jest **dokładniejsze niż cokolwiek, co robi sam Oura albo Strand domyślnie** — bo masz precyzyjny czas treningu z własnego logowania, nie zgadywany z samego HR. Wymaga: `oura_heartrate` ma tylko 14-dniowy rolling window (4.15) — przeliczenie musi się dziać blisko czasu treningu, nie retroaktywnie po miesiącu.

**`ActivityCostEngine` (już w 4. tabeli głównej) to ODRĘBNY mechanizm**, nie konkuruje z powyższym: liczy koszt recovery post-hoc na poziomie DNIA (dzień z tagiem aktywności vs next-morning Charge), nie per-sesja. Oba mają sens równolegle — per-sesja strain (precyzja) + dzienny recovery-cost per typ treningu (trend, "siłownia kosztuje mnie więcej niż bieganie").

**Odrzucone dodatkowo:** `WorkoutSport.kt` (mapowanie typ-sportu → Health Connect standard) — niepotrzebne, bo `exercise_logs.muscle_tags` już kategoryzuje trening dokładniej pod kątem własnych potrzeb niż generyczna lista sportów.

### 4.16 Drobne dodatki (niski koszt, rozsiane po drodze)
- **CaffeineDecay:** `fraction_remaining(t) = 0.5^(t/5.5)`, active gdy fraction>0.25 (~11h lead do cutoff przed snem). Dane już są (nutrition log z timingiem).
- **HydrationGoal:** `goal = sex_baseline + round(effort/100×700)`. M:3700ml, K:2700ml.
- **FitnessAge (Nes 2011, waist variant):** `FA = age + (rhrC·(RHR-65) - paiC·(PAI-5)) / ageC`. M: rhrC 0.155, paiC 0.226, ageC 0.296.

## 5. UX/produktowe wzorce do przejęcia (nie tylko matematyka)

| Wzorzec | Co robi | Zastosowanie w Vanguard |
|---|---|---|
| **Confidence pill (Solid/Building/Calibrating)** | Trójstanowy, szczery wskaźnik pewności pod każdym score, bez "% trust" | Każdy nowy score (readiness, dose-response, illness) musi pokazywać ten stan — nigdy nie udawać pewności, której nie ma |
| **Empty states, nie fabrykowane dane** | "Reading your journal and outcomes…" / "needs a few days of history" — szczery brak danych, nigdy flat-line fake | `vanguard-oracle` ma mówić "jeszcze się kalibruję" zamiast zgadywać liczbę |
| **Non-clinical microcopy** | Brak słów diagnostycznych. "moves your charge" nie "your health risk is X" | Styl komunikatów Oracle — obserwacja, nie diagnoza |
| **Weekly Digest** | Deterministyczny przegląd tydzień-do-tygodnia: 3 headline score (Charge/Effort/Rest) z delta chips, 1-2 focal points w plain English | Naturalny fit pod istniejący rytm tygodniowy w `vanguard-oracle`/Telegram — TBD czy już istnieje podobny mechanizm, sprawdzić przed budową |
| **Confounder-aware downgrade** | Illness alert automatycznie ścisza się, jeśli `behavior_log` wyjaśnia anomalię | Wzorzec logiki, opisany w 4.4 |
| **Compare two periods (Pearson r + plain-English)** | "r equals X across Y days" — czytelne podsumowanie korelacji, nie tylko liczba | Format do użycia w "What Moves You" insightach |
| **Settings: opt-in, wszystko OFF domyślnie** | Eksperymentalne/zaawansowane funkcje wymagają świadomego włączenia | Filozofia do zastosowania przy dodawaniu nowych score'ów — nie włączać automatycznie illness alerts/dose-response dla użytkownika, dopóki nie ma wystarczających danych (gate na confidence level, nie na decyzji UI) |

## 5a. Przegląd repo zamknięty — potwierdzona kompletność

Po 4 rundach przeglądu (StrandAnalytics 50 plików, android/analytics 60 plików, UX wzorce, ManualWorkoutRescore, NoopLocalAccess/StrandDesign/docs/Tools/marketing/CHANGELOG) repo jest wyczerpująco zmapowane. Nic więcej nie czeka na odkrycie.

**Negatywne znalezisko warte zanotowania:** Strand **nie ma periodyzacji treningowej** (brak mesocykli, deload, training blocks) — sprawdzone explicite, zero wyników na "periodization"/"mesocycle"/"deload" w całym repo. Jedyny proxy obciążenia to ACWR (4.9). Jeśli kiedyś potrzebna będzie periodyzacja w Vanguard, nie przyjdzie z tego źródła.

## 6. Co odrzucone (sprawdzone, nie wdrażamy)

| Element | Powód odrzucenia |
|---|---|
| WhoopProtocol, WhoopStore, BLE layers | Reverse-engineering protokołu BLE WHOOP — zero wartości bez fizycznego urządzenia WHOOP |
| DaytimeStress, NapDetector, ResonanceEngine/BreathPacer, smart alarm | Wymagają continuous BLE stream — niewykonalne przy manual Oura sync (ograniczenie potwierdzone w rozmowie) |
| CyclePhaseEngine | Nieistotne (nie dotyczy) |
| Lab Book (badania krwi) | Niski priorytet bez regularnych badań krwi |
| AICoach.swift (Strand/AI) | Duplikuje istniejącego `vanguard-oracle` |
| PDF export, onboarding wizard, multi-device BLE support | Czysto kosmetyczne / nieistotne dla systemu jednoosobowego bez własnego hardware |
| `oura_workouts`, `oura_sessions` (jako źródło danych, nie pliki Strand) | Jakub ma lepszy własny log treningowy (`workout_sessions`/`exercise_logs`), nie medytuje — patrz 4.17 |
| `WorkoutSport.kt` (mapowanie typ-sportu → Health Connect) | `exercise_logs.muscle_tags` już kategoryzuje trening dokładniej |

## 6a. AUDYT ŻYWEJ BAZY (zrobiony przed startem implementacji) — duża korekta

**Sprawdzone bezpośrednio w produkcyjnej bazie (Supabase MCP, projekt `pdvqkgfsqziqlhptatgf`) i w kodzie `compute-daily-strain/index.ts` — nie zgadywane.** Znaczna część Etapów 2-3 z tego planu **już istnieje i działa**, zanim ten plan został napisany:

| Co planowano | Realny stan |
|---|---|
| 4.1 Baselines (EWMA) | **JUŻ ŻYWE** — `compute-daily-strain` ma `ewmaBaseline()`, dosłowny port `Baselines.swift` (komentarz w kodzie: "NOOP port: Winsorized EWMA baseline"). Liczone dla HRV i RHR, in-function (nie stateful tabela, przeliczane z historii co run — funkcjonalnie równoważne). |
| 4.2 RecoveryScorer | **JUŻ ŻYWE** w `daily_strain.recovery_score` — logistic z HRV/RHR/sleep, ale **uproszczone wagi** (0.60/0.20/0.15, nie 0.55/0.20/0.15/0.05/0.05 — brak resp i skin_temp termów z oryginału). |
| 4.3 Strain (HR-based) | **CZĘŚCIOWO ŻYWE** — `oura_hr_zones_daily` (VIEW, nie tabela, agreguje `oura_heartrate` w strefy) zasila `cardio_load` w `daily_strain`, ale to jest **dzienny agregat**, nie per-sesja treningowa. Strain w `daily_strain` to mix: cardio (ze stref) + strength (sets/reps z exercise_logs) + steps + fueling penalty — nie czysty Edwards TRIMP. |
| 4.9 ReadinessEngine (ACWR+monotony) | **JUŻ ŻYWE** — `daily_strain.readiness_level` (primed/balanced/strained/rundown/insufficient), funkcja `computeReadiness()` w `compute-daily-strain/index.ts`, dosłowny port `ReadinessEngine.swift` z ACWR i Foster monotony. |
| 4.8 ScoreConfidence | **CZĘŚCIOWO** — `components.hrv_ewma_nValid` zapisywane, ale brak formalnych tier (Solid/Building/Calibrating) jako pole/UI. |
| 4.11 WeeklyDigest | **NIE ISTNIEJE w planowanej formie** — `vanguard-week-recap` to jakościowa narracja LLM (refleksja, "block5_material"), nie deterministyczny przegląd z headline score + delta chips. Rozstrzyga otwartą decyzję #3: budować od zera, nie nakłada się. |
| 4.1 `behavior_log` | **Potwierdzone: nie istnieje** (zero wyników w `list_tables` i grep po repo). |
| 4.4 IllnessSignalEngine | **Potwierdzone: nie istnieje** (zero wyników na "illness"/"confounder" w całym repo). |
| 4.5/4.6 DoseResponse/CorrelationEngine | **Potwierdzone: nie istnieje** (zero wyników na "dose_response"). |
| 4.10 RecoveryForecast | **Nie istnieje.** |
| 4.17 ManualWorkoutRescore (per-sesja strain) | **Nie istnieje** — `workout_sessions` ma `start_time`/`end_time`, ale nic nie wycina `oura_heartrate` z tego okna. To jest realna, niewykorzystana szansa. |
| 4.16 CaffeineDecay/HydrationGoal/FitnessAge/VitalityEngine | **Nie istnieją.** |

**Konsekwencja dla kolejności prac:** Etapy 2-3 z sekcji 7 (Baselines, RecoveryScorer, ReadinessEngine/ACWR) **nie wymagają budowy od zera** — wymagają audytu/ulepszenia istniejącego `compute-daily-strain` (np. dorzucić resp/skin_temp do recovery, dorzucić formalne confidence tiers) ORAZ dobudowania tego, czego tam świadomie nie ma: per-sesja strain (4.17) i `behavior_log` (Etap 1). To jest dużo mniejszy zakres pracy niż original plan zakładał.

## 7. Etapy budowy (kolejność wynika z zależności)

| Etap | Zakres | Status |
|---|---|---|
| **0. Planowanie** | Research repo, wzory, sanity check celu/legalności, ten dokument | ✅ ZAKOŃCZONY |
| **1. `behavior_log`** | Migracja `20260624110000_behavior_log_and_session_strain.sql` — tabela (date, behavior_key, value, note), RLS, indeksy | ✅ ZAKOŃCZONY (2026-06-24) |
| **2. Baselines + DayOwnerResolver** | ✅ EWMA dla HRV/RHR/**resp** już żywe w `compute-daily-strain` (deploy v15, 2026-06-24). **resp EWMA dodany** (floor 0.5, halfLife 14/21 jak reszta). Skin temp NIE ma własnego baseline — używa Oura's `temperature_deviation` wprost jako już-znormalizowany sygnał (4.2 zaktualizowane). DayOwnerResolver/timezone (4.7) zweryfikowane jako pokryte przez istniejącą zasadę `Europe/Warsaw` w `toWarsaw()` w tym samym pliku | ✅ ZAKOŃCZONY (2026-06-24) |
| **3. RecoveryScorer + per-sesja StrainScorer + ScoreConfidence** | ✅ Wszystko żywe i zweryfikowane na realnych danych (deploy v15). Recovery: pełne wagi 4.2 (HRV 0.55/RHR 0.20/sleep 0.15/resp 0.05/skin 0.05), zweryfikowane: 2026-06-23 → recovery_score=67, recovery_confidence="solid". Confidence tiers (4.8): `recovery_confidence`/`strain_confidence` w `daily_strain.components`, calibrating/building/solid zgodnie z `hrvEwma.nValid`/obecnością danych ze stref. Per-sesja strain: `rescore-workout-sessions` wdrożony i zacronowany (11:20 UTC) — paruje `workout_sessions.start_time/end_time` z `oura_heartrate`, Edwards TRIMP + Keytel kcal → nowe kolumny `workout_sessions.hr_*`. **Niezweryfikowane end-to-end dla per-sesja** — wszystkie 9 istniejących sesji starsze niż 14-dniowy rolling window `oura_heartrate`; zadziała dla treningów zalogowanych od 2026-06-24. **Uwaga:** osobny bug w `workout_sessions.start_time/end_time` (start==end albo 20h+ rozpiętość) zgłoszony jako odrębne zadanie (`task_74285e6b`), nie naprawiony w ramach tego etapu | ✅ ZAKOŃCZONY (2026-06-24), per-sesja strain czeka na pierwszy realny trening do potwierdzenia |
| **4. IllnessSignalEngine** | ✅ `supabase/functions/compute-illness-signal` — multi-signal anomaly (HRV↓/RHR↑/resp↑/skin_temp↑) z confounder suppression (`behavior_log` + sauna z `exercise_logs`). Cron 11:25 UTC. Zweryfikowane na realnych danych: dni "zdrowe" → `illness_level="quiet"`, dni bez baseline/danych → `null`/quiet (defensywnie, nie zgaduje) | ✅ ZAKOŃCZONY (2026-06-24) — brak jeszcze realnego "raised" epizodu do weryfikacji w praktyce, logika sprawdzona na czystych danych |
| **5. CorrelationEngine/DoseResponseEngine (+ DoseResponsePriors) → "What Moves You"** | **Odkryto, że `compute-correlations` już implementuje CorrelationEngine** (Pearson r + lagged + p-value) dla par ciągłych metryk — nie trzeba było budować od zera. Brakowało: grupowego porównania dla danych kategorialnych/dawki (`behavior_log`). Zbudowano `supabase/functions/compute-behavior-effects` — Welch t-test + Cohen's d + dose-response z Bayesian shrinkage (priory: alkohol -5pkt/drink, kofeina -4ms/krok). Zweryfikowane: zwraca `{results: [], behaviors_tracked: 0}` na pustym `behavior_log` — gracefully, bez błędu | ✅ ZAKOŃCZONY (2026-06-24) — czeka na realne dane z `behavior_log`, żeby dać pierwszy użyteczny output (min. 5 dni do confidence "Calibrating"→"Building") |
| **6. RecoveryForecast + WeeklyDigest + ComparisonEngine/RangeReport** | ✅ `compute-recovery-forecast` (strain debt + sleep adequacy + mean reversion, skale 0-21 strain przeskalowane proporcjonalnie z oryginału 0-100) i `compute-weekly-digest` (5 metryk, balance read, focal points, ComparisonEngine math wbudowany jako SeriesStat/PeriodComparison). Osobny standalone "Compare two periods" UI-tool NIE zbudowany — to feature niskiego priorytetu, zostawiony do Etapu 8 jeśli potrzebny. Zweryfikowane na żywych danych: forecast=68 (confidence=solid, 13 nocy), weekly digest poprawnie zgłosił "tylko 2 dni — zbyt wcześnie" | ✅ ZAKOŃCZONY (2026-06-24) |
| **7. Drobne dodatki** | ✅ CaffeineDecay (½-life 5.5h, inference z nazw potraw `daily_food_entries`), HydrationGoal (sex baseline + effort/21×700ml), FitnessAge (Nes 2011: RHR + PAI proxy ze steps), VitalityEngine (Gompertz 3-czynnik: RHR/HRV/sleep → body_age → vitality). Wszystko w `components` JSON, bez migracji. Zweryfikowane: 2026-06-23 → fitness_age=20, body_age=23, vitality=52, hydration=3737ml; kawa dziś → caffeine_active_mg=63, alert=true. ReadinessEngine (ACWR) już istniał wcześniej | ✅ ZAKOŃCZONY (2026-06-24) |
| **8. UX polish** | ✅ Confidence pills (Solid/Building/Calibrating) w DailyStrainCard dla recovery i strain. Secondary metrics row: Vitality score, Bio age (FitnessAge), kofeina alert (mg + amber chip), cel nawodnienia (L). Oracle/AI: daily_strain dodany do `gatherUserContext` state_vector (readiness block: strain, recovery, confidence, vitality, caffeine_alert, hydration). Pre-existing TS error w test fixture (hr_*) nie był blokujący. | ✅ ZAKOŃCZONY (2026-06-24) |

## 8. Otwarte decyzje

1. ~~Czy `daily_strain.recovery_score`/`strain_score` zostaje zastąpiony~~ — **ROZSTRZYGNIĘTE (6a):** NIE zastępujemy. `daily_strain` jest już używany przez inne funkcje (`vanguard-analyst`, `analyze-training-load`). Ulepszamy w miejscu: dorzucamy resp+skin_temp do recovery (4.2), dorzucamy formalne confidence tiers (4.8). Nieinwazyjne, addytywne zmiany do istniejących kolumn/JSON w `components`.
2. ~~Gdzie żyje `vanguard_readiness`~~ — **ROZSTRZYGNIĘTE:** nigdzie nowym — to po prostu ulepszony `daily_strain.recovery_score`. Nazwa "vanguard_readiness" z wcześniejszej części planu była koncepcyjna, nie wymaga nowej tabeli.
3. ~~Czy Weekly Digest już istnieje~~ — **ROZSTRZYGNIĘTE (6a):** nie, `vanguard-week-recap` to inny mechanizm (jakościowa narracja LLM). WeeklyDigest budować od zera jako nowa, deterministyczna funkcja.
4. Format `behavior_key` — wolna tekstowa wartość czy enum z ustaloną listą (alkohol, podróż, stres, choroba)? **Decyzja: wolny tekst**, zgodnie z konwencją repo (`exercise_name` w `exercise_logs` też jest wolnym tekstem, nie enum).
5. ~~Czy Oura API daje per-sekundowy strumień HR~~ — **ROZSTRZYGNIĘTE**: tak, 5-min interval, już w `oura_heartrate`.
6. Relacja HR-based strain vs treningowy strain — **ROZSTRZYGNIĘTE (6a):** `daily_strain.strain_score` zostaje (dzienny, mix cardio+strength+steps+fueling). Per-sesja strain (4.17) to NOWE, dodatkowe kolumny na `workout_sessions` (hr_avg, hr_peak, hr_strain_score, hr_kcal_est) — nie konkuruje z dziennym, daje precyzję per-trening.

## 9. Jak korzystać z tego dokumentu (dla agentów AI)

- Przed jakąkolwiek pracą nad tym tematem: przeczytaj cały ten plik.
- Po zaimplementowaniu etapu: zaktualizuj status w tabeli sekcji 7 (⬜ → ✅) i odpowiedz na otwarte decyzje w sekcji 8 jeśli zostały podjęte.
- Wzory w sekcji 4 są kanoniczne — nie wymyślaj wag/stałych na nowo, przepisz dokładnie te.
- Jeśli coś tu jest nieaktualne względem realnego stanu kodu, zaufaj kodowi i popraw ten dokument.
