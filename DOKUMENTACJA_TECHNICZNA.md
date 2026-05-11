# Kuba Workout — Dokumentacja Techniczna

> Data: 2026-05-09 | Wersja aplikacji: V2.2.1

---

## 1. Ogólny opis systemu

**Kuba Workout** to osobista aplikacja do śledzenia treningów i stylu życia, działająca jako progresywna aplikacja webowa (PWA). Realizuje 16-tygodniowy program transformacji sylwetki i integruje dane z czterech zewnętrznych źródeł:

- **Oura Ring** — sen, gotowość, HRV, RHR, temperatura, kroki
- **Yazio** — dieta, makroskładniki, per posiłek
- **Google Fit** — waga, % tkanki tłuszczowej, lokalizacja
- **Google Maps** — tagowanie POI (siłownia, dom, centrum)

Od wersji V2.2.1 aplikacja zawiera **silnik stanów operacyjnych** (State Engine) który codziennie klasyfikuje kondycję użytkownika i generuje wzorce behawioralne na bazie danych biometrycznych.

---

## 2. Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend | React 19.2.5 + Vite 8.0.10 + Tailwind CSS 4.2.4 |
| State management | Zustand 5.0.13 |
| Routing | React Router DOM 7.14.2 |
| Wykresy | Recharts 3.8.1 |
| Daty | date-fns 4.1.0 |
| Backend / DB | Supabase (PostgreSQL + RLS + Storage) |
| Serverless | Supabase Edge Functions (Deno/TypeScript) |
| Email | Resend API |
| PWA | Vite Plugin PWA |
| Icons | Lucide React 1.11.0 |

---

## 3. Schemat bazy danych

### 3.1 Tabele treningowe

#### `workout_sessions`
| Pole | Typ | Opis |
|---|---|---|
| id | UUID PK | — |
| user_id | UUID FK | — |
| workout_day | VARCHAR | 'A' / 'B' / 'C' / 'D' |
| date | DATE | domyślnie CURRENT_DATE |
| duration_minutes | INTEGER | — |
| session_notes | TEXT | — |
| start_time / end_time | TIMESTAMP | — |
| msp_passed | BOOLEAN | czy osiągnięto Maximum Strength Phase |

#### `exercise_logs`
| Pole | Typ | Opis |
|---|---|---|
| session_id | UUID FK | — |
| exercise_name | VARCHAR | — |
| set_number | INTEGER | — |
| reps | INTEGER | — |
| weight | DECIMAL(5,2) | kg |
| rpe | DECIMAL(3,1) | skala 0–2 (nie 0–10) |
| is_pws_or_msp | BOOLEAN | — |
| notes | TEXT | — |

### 3.2 Tabele zdrowotne / biometryczne

#### `oura_daily_summary`
| Pole | Typ | Opis |
|---|---|---|
| readiness_score | INTEGER | 0–100 |
| total_sleep_hours | DECIMAL(4,2) | — |
| deep_sleep_hours | DECIMAL(4,2) | **NOWE** |
| hrv_avg | INTEGER | **NOWE** — średnie HRV ms |
| rhr_avg | INTEGER | **NOWE** — Resting Heart Rate bpm |
| temp_deviation | DECIMAL(4,2) | **NOWE** — odchylenie temperatury °C |
| steps | INTEGER | — |
| bedtime_timestamp | TIMESTAMP | — |
| is_disciplined | BOOLEAN | sen przed 23:30 |

#### `daily_nutrition`
| Pole | Typ | Opis |
|---|---|---|
| calories | INTEGER | — |
| protein | DECIMAL(5,2) | g |
| carbs | DECIMAL(5,2) | g |
| fat | DECIMAL(5,2) | g |

#### `daily_food_entries`
| Pole | Typ | Opis |
|---|---|---|
| name | TEXT | nazwa produktu |
| calories | INTEGER | — |
| protein / carbs / fat | DECIMAL(5,2) | — |
| meal_type | TEXT | breakfast / lunch / dinner / snack |
| amount | TEXT | "100g", "1 piece", itp. |

#### `body_metrics`
Pomiary manualne: weight, waist, neck, chest, hips, belly, biceps_l, biceps_r, forearm, thigh, calf + `body_fat` (z Google Fit)

### 3.3 Tabele behawioralne

#### `daily_wins` (Power List)
- 5 zadań dziennie (task_1–5) z kategoriami: `ciało` / `duch` / `konto`
- Wynik dnia: `Z` (Win = 5/5) / `P` (Loss = <5/5)
- mood_score (1–5), gratitude_entry, journal_entry

#### `habits`
- `user_id`, `name`, `icon` (emoji), `is_positive` (boolean)
- Lista niestandardowych nawyków użytkownika

#### `habit_logs`
- `user_id`, `habit_id`, `date`, `completed` (boolean)
- Dzienny log per nawyk

#### `weekly_reviews`
- `user_id`, `week_start` (DATE)
- proud_of, sabotage, do_differently (TEXT)
- UNIQUE(user_id, week_start)

#### `daily_habits`
- Stały zestaw nawyków (couch_stretch, chin_tucks, glute_bridge, child_pose, bar_hang, protein_170g)

### 3.4 Tabele tożsamości / celów

#### `user_fundament`
- `user_id` PK
- identity, philosophy, vision, finances, knowledge, relationships (TEXT)

#### `life_goals`
- `user_id` PK
- goal_cialo, goal_duch, goal_konto (TEXT)
- date_cialo, date_duch, date_konto (DATE — daty docelowe)

### 3.5 Tabele techniczne / systemowe

#### `user_settings`
- Tokeny API: oura_token, yazio_username, yazio_password, yazio_token
- Google Fit: google_fit_client_id, google_fit_client_secret, google_fit_refresh_token
- height, disciplined_streak, total_disciplined_days

#### `location_history`
- latitude, longitude, accuracy, place_name (z Google Maps)
- is_manual, UNIQUE(user_id, created_at)

#### `progress_photos`
- Zdjęcia sylwetki z datą (Storage: bucket "progress-photos")

---

## 4. Silnik stanów operacyjnych (State Engine) — NOWE

Plik: `src/lib/stateEngine.js`

### 4.1 Stany operacyjne (OPERATING_STATES)

| Stan | Kolor | Znaczenie |
|---|---|---|
| LOCKED_IN | Zielony | Maksymalna zgodność z tożsamością |
| MOMENTUM | Niebieski | Budowanie serii, dobry kierunek |
| RECOVERY | Bursztynowy | Planowane odbudowanie |
| CHAOS | Czerwony | Utrata kontroli |
| AVOIDANCE | Pomarańczowy | Zasoby są, ale unikanie działania |
| STABLE | Szary | Tryb utrzymania |

### 4.2 Algorytm `detectState(data)`

Ocenia: wynik Power List (Z/P), readiness Oura, sen, trening, białko, serię dyscypliny, napięcie biometryczne → zwraca aktualny stan operacyjny.

### 4.3 Identity Score `calculateIdentityScore(data)` — 0 do 100

Startuje od 100, odejmuje punkty karne:

| Warunek | Kara |
|---|---|
| Dzień przegrany (P) | -30 |
| Brak Power List | -10 |
| Brak treningu przy aktywnej serii | -10 |
| Białko < 140g | -15 |
| Sen < 6.5h | -15 |
| Readiness < 60 | -10 |
| HRV < 30ms | -10 |
| RHR > 65 bpm | -10 |
| Odchylenie temp > 0.5°C | -15 |

### 4.4 Tłumaczenie biometrii `translateBiometrics(oura)`

Automatycznie generuje tablicę wniosków:
- Temp > 0.5°C → "organizm walczy z infekcją lub stresem"
- HRV < 30 → "zmęczenie układu nerwowego"
- deep_sleep < 1.5h → "zaburzony proces regeneracji tkanek"
- RHR > 65 → "serce pracuje pod obciążeniem"

### 4.5 Wykrywanie wzorców `discoverPatterns(history, bodyMetrics, ouraData)`

Zwraca tablicę obiektów wzorców:
- **Wzorzec snu**: Po 7.5h+ snu readiness rośnie o ~15%
- **Wzorzec upadku po sukcesie**: Zwiększone ryzyko chaosu w 4. dniu dobrej serii

---

## 5. Funkcjonalności aplikacji

### 5.1 Dashboard (V2.2.1)

Nowe elementy względem poprzedniej wersji:
- **Widget stanu operacyjnego** — kolorowy baner z aktualnym stanem (LOCKED_IN/CHAOS/itp.)
- **Identity Score** — pasek 0–100% z aktualną oceną dnia
- **Personal Operating Manual** — wygenerowane wzorce behawioralne z danych biometrycznych
- **Powiadomienie o 20:30** — przypomnienie przez `useNotifications.js`

Pozostałe elementy:
- Szybki start treningów A/B/C/D
- Ostatnia sesja Day A z sugestią progresji i MSP feedback
- Tabela progresji bench press (16 tygodni → 100kg)
- Tygodniowy budżet kaloryczny (12 600 kcal = 1 800/dzień)
- Sekcja zasad fundamentalnych (białko, deficyt, kroki, sen)

### 5.2 Moduł treningowy (WorkoutExecution.jsx)

- Interfejs per seria: numer, waga (kg), powtórzenia, RPE (0–2)
- Auto-timer 90 sek po wpisaniu powtórzeń
- Porównanie z poprzednią sesją
- Auto-zapis roboczy do localStorage (odporność na crash)
- Detekcja zamiany waga/powtórzenia dla ćwiczeń złożonych
- Notatki sesji

**Program treningowy (4-dniowy split):**

| Dzień | Nazwa | Fokus |
|---|---|---|
| A | Góra Ciężka | Wyciskanie top set 1×3-5 + 3×5-6, Pull-ups obciążone |
| B | Plecy/Barki/RDL | Lat pulldown, OHP, Face pulls, Lateral raises, RDL |
| C | Nogi/APT/Core | Przysiady, Hip thrust, Reverse lunges, Pallof press |
| D | Lekka Góra | Bench lekki 5×5, Chin-ups BW, Dips, Curls |

**Codzienna rutyna (DAILY_ROUTINE — 7 ćwiczeń korekcyjnych):**
Couch stretch, Active dead hang, Glute bridge, Chin tucks, Dead bug, Foam roll TFL/quads, Pec minor stretch

**Progresja Bench Press (16 tygodni → 100kg):**
- Start: 77.5kg, +2.5kg top set co ~2 tygodnie
- Tydzień 16 = próba PR 100kg

### 5.3 OuraWidget (rozszerzony)

Nowe dane względem poprzedniej wersji:
- **HRV** (Heart Rate Variability) — ms
- **RHR** (Resting Heart Rate) — bpm
- **Temperatura** — odchylenie od baseline
- **AI insights** — automatyczne wnioski z biometrii (zob. stateEngine)
- Porównanie dzisiaj vs wczoraj ze strzałkami trendu

### 5.4 Stats.jsx (rozszerzony)

Nowe elementy:
- **Projekcja 6-tygodniowa** — liniowa regresja wagi i tali
- **Behavioral narrative** — auto-generowane tygodniowe podsumowanie postępu
- Wykres: waga + talia + % BF (potrójny)
- Wykres: readiness Oura + sen (60 dni)
- Wykres: białko vs cel 150g
- Historia 40 sesji z edycją inline i usuwaniem
- Eksport Markdown z pełnym kontekstem

### 5.5 Direction.jsx (Power List)

- Cele życiowe (Ciało/Duch/Konto) z datami docelowymi
- Power List: 5 zadań/dzień, auto-finalizacja o 23:00
- Planowanie dnia jutrzejszego
- Nawyki: własna lista z emoji, heatmapa 30 dni
- Journaling: nastrój 1–5, wdzięczność, refleksje (autosave 2s)
- Weekly Review (tylko niedziela): 3 prompty
- Stats: seria, tygodniowe/miesięczne win ratio, kalendarz 30 dni

### 5.6 Pozostałe widoki

- **Photos.jsx** — upload, porównanie before/after, oś czasu, grayscale→kolor on hover
- **Fundament.jsx** — 6 sekcji tożsamości, autosave 2s debounce

---

## 6. Edge Functions (Deno/TypeScript)

### `sync-oura`
Dane: readiness, sen (total + deep), HRV, RHR, temperatura, kroki, pora snu
Oblicza: dyscyplinę (sen przed 23:30), streak, total disciplined days

### `sync-yazio`
1. Auth Yazio (username/password)
2. Pobiera consumed items per posiłek (N dni, domyślnie 1, max 30)
3. Fallback do daily_summary jeśli brak per-item danych
4. Normalizacja jednostek, cache produktów
5. UPSERT: daily_nutrition + DELETE/INSERT daily_food_entries

### `sync-google-fit`
1. OAuth2 refresh → access token
2. Ostatnie 30 dni: waga + % BF → body_metrics
3. Ostatnie 7 dni lokalizacji (co 5. punkt) → location_history
4. Tagowanie POI przez Google Maps Nearby Search (50m, type=gym)

### `google-fit-auth`
OAuth2 callback: wymiana code → refresh_token → zapis do user_settings

### `weekly-report`
Generuje PDF (jsPDF): delta wagi/tali, max bench, compliance, avg readiness
Wysyła przez Resend API co niedzielę (pg_cron)

### `daily-reminder`
Edge function (nowa) — trigger przypomnień dziennych

---

## 7. Hooki (Custom React Hooks)

### `useDashboardData.js`
Agreguje dane dashboardu:
- `mspFeedbackMap` — ostatni MSP per typ dnia
- `lastDayASession` — ostatnia sesja Day A z logami
- `weeklyCalories` — suma od poniedziałku
- `todayWin` — Power List na dziś
- `proteinToday` — gramy białka dziś
- `hasWorkoutToday` — boolean
- `ouraToday` — ostatnie 30 dni Oura
- `streak` — seria dyscyplinowanych dni

### `useNotifications.js` — NOWE
- Prosi o pozwolenie na powiadomienia przy montowaniu
- Sprawdza czas co 30 sekund
- O 20:30 wysyła powiadomienie przeglądu wieczornego
- Zabezpieczenie przed duplikatami tego samego dnia (localStorage)

### `useStats.js`
- Kalkulacja trendów, projekcja 6-tygodniowa (regresja liniowa)
- `exportData(dateRange, options)` → plik Markdown

---

## 8. Zbieranie i analiza danych — stan aktualny

### 8.1 Co jest zbierane

| Kategoria | Dane | Źródło | Częstotliwość |
|---|---|---|---|
| Trening | Ćwiczenie, serie, powtórzenia, waga, RPE | Manualne | Per sesja |
| Trening | MSP pass/fail, czas trwania | Auto | Per sesja |
| Sen | Godziny (total + deep), pora snu | Oura API | Codziennie |
| Biometria | Readiness, HRV, RHR, temperatura | Oura API | Codziennie |
| Aktywność | Kroki | Oura API | Codziennie |
| Dieta | Kalorie, białko, węgle, tłuszcz per posiłek | Yazio API | Codziennie |
| Sylwetka | Waga, pomiary, % BF | Google Fit + manualne | Przy pomiarze |
| Lokalizacja | GPS coords, POI (siłownia/dom) | GPS + Google Maps | Co 20 min lub 250m |
| Psychologia | Mood 1–5, wdzięczność, journaling | Manualne | Codziennie |
| Dyscyplina | Power List 5 zadań, wynik W/L | Manualne | Codziennie |
| Nawyki | Własna lista, checkboxy | Manualne | Codziennie |
| Zdjęcia | Postęp sylwetki z datą | Manualne | Dowolnie |

### 8.2 Aktualne przetwarzanie danych

| Analiza | Gdzie | Status |
|---|---|---|
| Identity Score (0–100) | stateEngine.js + Dashboard | ✅ Aktywne |
| Stan operacyjny (6 stanów) | stateEngine.js | ✅ Aktywne |
| Wzorce behawioralne (snu, upadku po sukcesie) | stateEngine.js | ✅ Aktywne |
| Projekcja wagi/tali (6 tygodni) | useStats.js | ✅ Aktywne |
| Behavioral narrative (tygodniowe podsumowanie) | Stats.jsx | ✅ Aktywne |
| Detekcja dyscypliny (sen przed 23:30) | sync-oura | ✅ Aktywne |
| Tagowanie lokalizacji (POI) | sync-google-fit + LocationTracker | ✅ Aktywne |
| Powiadomienia o 20:30 | useNotifications.js | ✅ Aktywne |
| Raport PDF tygodniowy | weekly-report (edge fn) | ✅ Opcjonalne (cron) |

### 8.3 Pozostałe luki analityczne

1. **Brak auto-syncronizacji** — Oura i Yazio wymagają ręcznego kliknięcia (brak pg_cron)
2. **Brak korelacji snu vs. siły** — dane są, ale brak wykresu scatter (readiness vs max bench)
3. **Brak wykresu RPE trend** — RPE logowane, ale niewidoczne analitycznie
4. **Lokalizacja nieużywana w UI** — zbierana, tagowana, ale brak mapy/visualizacji
5. **Eksport tylko Markdown** — brak CSV, brak integracji z zewnętrznymi narzędziami
6. **Alerty progowe nieistnieją** — np. readiness <70 przez 3 dni → push/banner

---

## 9. Możliwe automatyzacje — propozycje

### 9.1 Auto-sync przez pg_cron (najprostsze do wdrożenia)

```sql
-- Oura sync o 07:00 codziennie
select cron.schedule('sync-oura-daily', '0 7 * * *',
  $$select net.http_post(
    url := 'https://<PROJECT>.supabase.co/functions/v1/sync-oura',
    headers := '{"Authorization": "Bearer <SERVICE_KEY>"}'::jsonb
  )$$
);

-- Yazio sync o 00:05 codziennie
select cron.schedule('sync-yazio-daily', '5 0 * * *', ...);
```

### 9.2 Alerty progowe (nowa tabela + trigger)

```sql
create table alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  type text,       -- 'low_readiness', 'missed_protein', 'streak_risk'
  severity text,   -- 'info' / 'warning' / 'critical'
  message text,
  date date,
  seen boolean default false
);
```

Przykładowe reguły:

| Trigger | Warunek | Alert |
|---|---|---|
| Po sync Oura | readiness < 70 przez 3 dni | "Krytyczne zmęczenie — deload" |
| Po sync Yazio | protein < 130g | "Białko poniżej minimum" |
| O 22:00 | Power List <3/5 | "Zostało X zadań na dziś" |
| Po sesji Day A | waga wzrosła bez MSP | "Sugerowana progresja +2.5kg" |

### 9.3 Korelacje zmiennych (nowa Edge Function)

Dane już są — brak tylko analizy. Warte zbadania:

| Zmienna A | Zmienna B | Pytanie |
|---|---|---|
| Oura readiness | Max weight bench press | Czy odpoczynek → lepsza siła? |
| Godziny snu | Power List compliance | Czy po złym śnie mniej robisz? |
| Kalorie tydzień | Zmiana wagi (lag 7 dni) | Kalibracja deficytu |
| Białko g/kg | RPE na tej samej wadze | Czy dieta → łatwiejszy trening? |
| HRV | Wynik sesji dnia kolejnego | Predykcja jakości treningu |

### 9.4 Wykres RPE Trend

RPE z `exercise_logs` per ćwiczenie nie jest jeszcze wizualizowane. Dodanie jednego wykresu do Stats (RPE bench press na osi czasu) pozwoli obserwować czy trening staje się łatwiejszy przy tej samej wadze.

### 9.5 AI Coach (Claude API)

Dane biometryczne + treningowe + behawioralne są wystarczająco bogate. Możliwe edge function `ai-coach`:

1. **Analiza RPE patterns** — "Twoje RPE na bench rosło 3 tygodnie przy stałej wadze — znak do deloadu"
2. **Sugestie żywieniowe** — "Wczoraj 1400 kcal — za mało. Dziś uzupełnij o 500 kcal"
3. **Trend nastrojów** — analiza mood_score z ostatnich 30 dni
4. **Auto weekly review** — Claude generuje podsumowanie tygodnia na bazie surowych danych jako punkt startowy do refleksji

### 9.6 Przyszłe integracje

| Integracja | Nowe dane | Wartość |
|---|---|---|
| Strava | Bieganie, cardio (tętno, pace, dystans) | Pełen obraz aktywności |
| Apple Health / Health Connect | Tętno spoczynkowe z telefonu | Dokładniejszy recovery |
| WhatsApp / Telegram Bot | Push z zewnątrz aplikacji | Niższy friction dla przypomnień |

---

## 11. Warstwa Semantyczna (Semantic Layer) — NOWE V5/V6

### 11.1 Architektura pamięci semantycznej
System przeszedł z modelu "baza danych" na model "pamięć epizodyczna" wykorzystujący:
- **pgvector**: Przechowywanie wektorów znaczeniowych (1536 wymiarów) dla wszystkich treści tekstowych.
- **Hybrid Retrieval**: Algorytm rankingu łączący podobieństwo semantyczne (50%), ważność (30%) i świeżość (20%).
- **Episodic Memory**: Każdy dopasowany semantycznie rekord automatycznie dociąga pełny kontekst biometryczny (HRV, Sen, Stan) z danego dnia.

### 11.2 Kluczowe tabele semantyczne
- `vanguard_knowledge`: Skarbiec wiedzy (książki, kursy) z embeddingami.
- `vanguard_temporal_links`: Tabela przyczynowości, łącząca zdarzenia w czasie (np. Stan Chaosu -> Interwencja -> Poprawa Bio).

### 11.3 Silnik wyszukiwania (`match_vanguard_content`)
Funkcja SQL RPC realizująca hybrydowy ranking:
```sql
score = (similarity * 0.5) + (importance * 0.3) + (recency_decay * 0.2)
```

---

## 12. Bezpieczeństwo

- **RLS** włączone na wszystkich tabelach — `auth.uid() = user_id`
- Tokeny API przechowywane w `user_settings` (po stronie serwera)
- Brak zewnętrznych narzędzi analitycznych (GA, Mixpanel)
- Supabase automatyczne backupy
- Zdjęcia w prywatnym bucket Storage

---

## 11. Zmienne środowiskowe

### Frontend (`.env`)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Supabase Secrets (Edge Functions)
Wymagane do poprawnego działania warstwy semantycznej i integracji:
```bash
npx supabase secrets set OPENAI_API_KEY=sk-...
npx supabase secrets set TELEGRAM_BOT_TOKEN=...
npx supabase secrets set TELEGRAM_CHAT_ID=...
npx supabase secrets set VANGUARD_USER_ID=...
```

### Zmienne środowiskowe Edge Functions
- `SUPABASE_URL` (auto)
- `SUPABASE_SERVICE_ROLE_KEY` (auto)
- `GOOGLE_MAPS_API_KEY`
- `RESEND_API_KEY`
- `OPENAI_API_KEY` (Vanguard Oracle & Backfill)

---

## 13. Procedura wdrożenia warstwy semantycznej

1. **Baza danych**: Wykonaj migracje `migration_v6_*.sql` w SQL Editorze Supabase.
2. **Sekrety**: Ustaw klucze API za pomocą `supabase secrets set`.
3. **Funkcje**: Zdeployuj funkcje `vanguard-oracle` i `save-daily-aggregate`.
4. **Backfill**: Uruchom `node scratch/backfill_embeddings.js` (wymaga lokalnego ustawienia kluczy w pliku lub env).
5. **Automatyzacja**: Skonfiguruj `pg_cron` dla `save-daily-aggregate`, aby budować historię baseline.

---

## 14. Struktura plików

```
kuba-workout/
├── package.json
├── vite.config.js          (PWA plugin, proxy Oura)
├── tailwind.config.js      (dark theme, kolory dni A/B/C/D)
├── schema.sql              (główny schemat DB)
├── migration_*.sql         (migracje: yazio, kierunek, journal, weekly_review,
│                            fundament, location, food_entries)
├── supabase/
│   ├── migrations/
│   │   └── 20260504235214_add_weight_italia.sql
│   └── functions/
│       ├── sync-oura/index.ts
│       ├── sync-yazio/index.ts
│       ├── sync-google-fit/index.ts
│       ├── google-fit-auth/index.ts
│       ├── weekly-report/index.ts
│       └── daily-reminder/index.ts
├── public/
│   ├── sw.js               (Service Worker)
│   ├── manifest.json
│   └── pwa-192x192.png / pwa-512x512.png
└── src/
    ├── App.jsx
    ├── main.jsx            (rejestracja SW)
    ├── index.css
    ├── components/
    │   ├── Auth.jsx
    │   ├── Dashboard.jsx         (V2.2.1 — State Engine, Identity Score)
    │   ├── WorkoutExecution.jsx
    │   ├── Stats.jsx             (projekcja, narrative, eksport)
    │   ├── Direction.jsx         (Power List, nawyki, journaling)
    │   ├── Photos.jsx
    │   ├── Fundament.jsx
    │   ├── OuraWidget.jsx        (HRV, RHR, temp, AI insights)
    │   ├── LocationTracker.jsx
    │   └── ProgressionTable.jsx
    ├── hooks/
    │   ├── useDashboardData.js
    │   ├── useNotifications.js   (NOWE — powiadomienie 20:30)
    │   └── useStats.js
    ├── lib/
    │   ├── supabase.js
    │   ├── oura.js
    │   └── stateEngine.js        (NOWE — 6 stanów, Identity Score, wzorce)
    ├── store/
    │   └── useStore.js
    └── data/
        └── workoutPlan.js
```

---

## 13. Progi i metryki

| Metryka | Próg | Kontekst |
|---|---|---|
| Identity Score | 0–100 | Codzienna ocena kondycji |
| Readiness | < 70 → recovery | Oura |
| Białko | ≥ 150g / dzień | Cel |
| Sen | ≥ 7.5h | Optimal |
| HRV | ≥ 30ms | < 30 = zmęczenie NS |
| RHR | ≤ 65 bpm | > 65 = obciążenie |
| Temp. odchylenie | ≤ 0.5°C | > 0.5 = stres/infekcja |
| Tygodniowy deficyt | 300–500 kcal | Rekompo |
| Kroki | 8 000–10 000 / dzień | — |
| Sync lokalizacji | > 250m lub > 20 min | Threshold |
| Power List Win | 5/5 zadań | Wynik Z |
| Bench progresja | +2.5kg co ~2 tygodnie | 16 tygodni |

---

## 14. Priorytety do wdrożenia

| Priorytet | Zadanie | Złożoność | Wpływ |
|---|---|---|---|
| 🔵 Gotowe | Warstwa Semantyczna (pgvector + Hybrid Search) | Wysoka | Inteligentna pamięć bota |
| 🔴 Wysoki | pg_cron auto-sync (Oura + Yazio) | Niska | Dane zawsze aktualne |
| 🔴 Wysoki | Alerty progowe w UI | Średnia | Realtime feedback |
| 🟡 Średni | Wykres RPE trend (bench) | Niska | Widoczność adaptacji |
| 🟡 Średni | Korelacja sen vs. siła (scatter plot) | Średnia | Wgląd w recovery |
| 🟡 Średni | Eksport CSV | Niska | Zewnętrzna analiza |
| 🟡 Średni | Wizualizacja lokalizacji (mapa) | Średnia | Dane są, brak UI |
| 🟢 Niski | Temporal Links (Auto-detection) | Wysoka | Causal Intelligence |
| 🟢 Niski | AI Coach (Claude API) | Wysoka | Personalizowany feedback |
