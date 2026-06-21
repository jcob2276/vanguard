# Ekstremalny Audyt Kodu — Frontend / Scripts / SQL
_Metodologia: Paranoid Tech Lead | Klasy: DST · Memory · Silent Failures · SQL · Infinite Loops_

---

## 🔴 CRITICAL — Natychmiast

### [C1] Hardcoded credentials w 4 plikach Python
**Lokalizacja:**
- `scripts/garmin_activity_detail.py:10-11`
- `scripts/garmin_interval_detail.py:10-11`
- `scripts/garmin_enrich.py:15-16`
- `scripts/garmin_auth.py:11-12`

**Ryzyko:** Hasło do konta Garmin w plain text w repozytorium git. Każdy kto zobaczy historię commita (np. przy wyciek repo, fork, GitHub Copilot) dostaje dostęp do konta i powiązanych aktywności/lokalizacji. Pattern:
```python
EMAIL    = "jakubsobon3@gmail.com"
PASSWORD = "Czarek100!"
```

**Naprawa:** Przenieść do `.env` lub `os.environ.get('GARMIN_EMAIL')`. Dodać `scripts/.env` do `.gitignore`. Opcjonalnie: rotacja hasła na wypadek gdyby commit był kiedyś publicznie dostępny.

---

### [C2] `strava_activities_clean` — utrata `security_invoker` po DROP/CREATE
**Lokalizacja:** `supabase/migrations/20260612000003_strava_activities_clean_add_gc_columns.sql:3-5`

**Ryzyko:** Migration `20260611150000_database_security_advisories.sql` ustawiła `security_invoker = true` na tym widoku. Następnie migration `20260612000003` zrobiła `DROP VIEW IF EXISTS strava_activities_clean; CREATE VIEW ...` — `DROP + CREATE` kasuje wszystkie opcje widoku, w tym `security_invoker`. Widok teraz działa jako `security_definer` (domyślne), omijając RLS. Każdy autentykowany użytkownik może czytać aktywności Strava innych użytkowników.

**Naprawa:**
```sql
ALTER VIEW public.strava_activities_clean SET (security_invoker = true);
```
Dodać do nowej migracji lub do istniejącego widoku po każdym jego przesłaniu.

---

### [C3] `strain_correlations` — brak `security_invoker` w ogóle
**Lokalizacja:** `supabase/migrations/20260612000002_strava_activities_clean_add_best_efforts.sql:113`

**Ryzyko:** Widok `strain_correlations` łączy dane z `daily_strain`, `oura_daily_summary`, `daily_nutrition`, `strava_activities_clean` — wszystkie chronione przez RLS. Widok powstał po migracji bezpieczeństwa i nigdy nie dostał `security_invoker = true`. Działa jako `security_definer` → dowolny autentykowany użytkownik może zapytać `SELECT * FROM strain_correlations` i dostać dane wszystkich użytkowników.

**Naprawa:**
```sql
ALTER VIEW public.strain_correlations SET (security_invoker = true);
```

---

## 🟠 HIGH — Naprawić przed następnym release

### [H1] Frontend `fetch()` bez `AbortSignal` — 10 miejsc
**Lokalizacja:**
| Plik | Linia |
|------|-------|
| `src/hooks/useSyncActions.ts` | 20, 47 |
| `src/hooks/useDashboardData.ts` | 119, 160 |
| `src/components/desktop/DesktopDashboard.tsx` | 296 |
| `src/components/core/stats/statsApi.ts` | 5, 26, 39 |
| `src/components/biometrics/DailyStrainCard.tsx` | 86 |
| `src/components/lifestyle/LinksInbox.tsx` | 102, 129 |
| `src/components/lifestyle/WeeklyReview.tsx` | 145, 186 |

**Ryzyko:** Żaden z tych fetch-ów nie ma timeoutu. Jeśli Supabase/Edge Function nie odpowie, Promise wisie w nieskończoność. Efekt: przycisk sync "kręci się" wiecznie, UI zamrożony, nie ma możliwości ponowienia próby.

**Naprawa:** Dodać `signal: AbortSignal.timeout(15000)` do każdego fetch. Wzorzec:
```typescript
const res = await fetch(url, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(15000),
});
```

---

### [H2] DST bug — `Date.now() - n * ms` bez kotwicy południa (2 miejsca)
**Lokalizacja:**
- `src/components/core/stats/statsApi.ts:22` — `formatWarsawDate(Date.now() - (analyzePeriod - 1) * 864e5)`
- `src/components/biometrics/MuscleHeatmap.tsx:158` — `formatWarsawDate(Date.now() - period * 24 * 3600 * 1000)`

**Ryzyko:** `Date.now()` to bieżący moment UTC w milisekundach. Odejmowanie `n * 86400000` daje datę n*24h temu — ale przy zmianie czasu (March/October) dzień ma 23h lub 25h. Jeśli użytkownik otworzy apkę o 00:30 w noc zmiany czasu, `Date.now() - 30 * 86400000` wyląduję o 23:30 poprzedniego dnia, a `formatWarsawDate` poprawnie zakwalifikuje to jako dzień wcześniejszy — czyli pobierze dane od `n_calendar_days + 1` dni temu zamiast `n_calendar_days`.

**Naprawa:** Użyć wzorca UTC-string z kotwicą 12:00:
```typescript
const dateLimit = (() => {
  const d = new Date(getTodayWarsaw() + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - period);
  return d.toISOString().split('T')[0];
})();
```

---

### [H3] DST bug w obliczaniu dni sprintu — midnight anchor
**Lokalizacja:** `src/components/desktop/desktopUtils.ts:279-291` (`getSprintInfo`)

**Ryzyko:** Kotwica sprintu jest konstruowana jako `new Date('YYYY-03-01T00:00:00')` — to polnocy w lokalnej strefie czasowej przeglądarki, nie w UTC ani nie w Warsaw. W Node.js/Vercel (UTC) to byłoby `2026-03-01T00:00:00 UTC` = 01:00 Warsaw zimą. Następnie `daysSince = Math.floor((d.getTime() - anchor.getTime()) / 86400000)` gdzie `d` jest `T12:00:00` local, a `anchor` jest `T00:00:00` local. W noc zmiany czasu (29 marca) dzień ma 23h, więc `diff / 86400000` może zwrócić 27.xx zamiast 28.xx, co skróci sprint o 1 dzień i zmyli numery tygodnia/dnia.

**Naprawa:** Ustabilizować kotwicę do stałej daty UTC lub użyć konsekwentnie `T12:00:00Z`:
```typescript
let anchor = new Date(`${yr}-03-01T12:00:00Z`);
```

---

### [H4] `vanguard_stream` — brak indeksu na `created_at`
**Lokalizacja:** Wszystkie migracje tworzące/modyfikujące tabelę `vanguard_stream`

**Ryzyko:** Tabela `vanguard_stream` jest najczęściej odpytywaną tabelą w projekcie — każda funkcja która przetwarza dane behawioralne filtruje po `created_at` (`.gte('created_at', someDate)`). Przy braku indeksu każde takie zapytanie to full table scan. Przy założeniu 1000+ wpisów dziennie i 90-dniowym oknie = ~90k wierszy na scan.

Miejsca odpytujące tabelę po `created_at`:
- `vanguard-weekly-synthesis` — `gte('occurred_at', cut7d.toISOString())`
- `saturdayCheckin.ts` — `.gte('created_at', cut7d.toISOString())`
- `vanguard-oracle` — wielokrotnie

**Naprawa:**
```sql
CREATE INDEX IF NOT EXISTS idx_vanguard_stream_created_at
  ON public.vanguard_stream (user_id, created_at DESC);
```

---

## 🟡 MEDIUM — Techniczny dług do spłacenia

### [M1] Python bare dict access — KeyError przy zmianie API Garmin
**Lokalizacja:**
- `scripts/garmin_enrich.py:59` — `sa["start_date"]`
- `scripts/garmin_interval_detail.py:132` — `avg = iv["avg_spd"]`
- `scripts/garmin_interval_detail.py:135` — `f"{iv['dur_s']:.0f}s"`

**Ryzyko:** Garmin Connect API zmienia pola bez ostrzeżenia. Jeśli klucz zniknie ze słownika, skrypt padnie z `KeyError` zamiast degradować gracefully.

**Naprawa:**
```python
sa_start = sa.get("start_date", "")  # zamiast sa["start_date"]
avg = iv.get("avg_spd", 0)
```

---

### [M2] DST w obliczaniu dni w `todoUtils.ts`
**Lokalizacja:** `src/components/todo/todoUtils.ts:74`
```typescript
(new Date(dateStr + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000
```

**Ryzyko:** `T00:00:00` bez strefy = polnoc lokalna. Na dzień zmiany czasu (marzec/październik) polnoc ma 23h lub 25h zamiast 24h, przez co `/ 86400000` może dać `.96` lub `1.04` zamiast `1.0`. Używane do ustalania bucketu "today/tomorrow/overdue" — błąd może wyświetlić zadanie jako "overdue" które jest "today".

**Naprawa:**
```typescript
// Użyć daty-string diff zamiast Date arithmetic:
const diff = dateStr > today ? 1 : dateStr === today ? 0 : -1;
// lub: (prosty string comparison działa dla YYYY-MM-DD)
```

---

### [M3] DST w `useNudgeData.ts` — liczba dni od ostatniego review
**Lokalizacja:** `src/hooks/useNudgeData.ts:22`
```typescript
setReviewOverdueDays(Math.floor((Date.now() - last.getTime()) / 86400000));
```

**Ryzyko:** Jak wyżej — przy zmianie czasu `Math.floor` może zaokrąglić w dół, zaniżając liczbę zaległych dni o 1 (review wyglądający jak 7 dni opóźnienia może pokazać 6).

**Naprawa:**
```typescript
const today = getTodayWarsaw();
const lastDay = last.toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
// diff jako liczba dni między stringami YYYY-MM-DD
const d1 = new Date(today + 'T12:00:00Z');
const d2 = new Date(lastDay + 'T12:00:00Z');
setReviewOverdueDays(Math.round((d1.getTime() - d2.getTime()) / 86400000));
```

---

### [M4] DST w skrypcie ops e2e
**Lokalizacja:** `scripts/ops/e2e-daily-loop.mjs:74`
```javascript
const ago = (days) => new Date(Date.now() - days * 864e5)
  .toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
```

**Ryzyko:** Skrypt CI/cron uruchamiany w nocy zmiany czasu może pobrać date o 1 dzień za mało. W skrypcie e2e testowym powoduje to fałszywy "brak danych" dla testowanego dnia.

**Naprawa:**
```javascript
const ago = (days) => {
  const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
};
```

---

### [M5] `ErrorBoundary` wrapa tylko root — pominięte lazy subtree errors
**Lokalizacja:** `src/App.tsx:63-67`

**Ryzyko:** Jedyna `ErrorBoundary` wrapa cały `<App />` jako root boundary. Komponenty lazy-load (`WorkoutLogger`, `Stats`, `Direction`, itp.) mają własne `Suspense` ale nie mają osobnych `ErrorBoundary`. Jeśli którykolwiek z nich rzuci wyjątek renderowania (np. null access na danych z API), cały root resetuje się do "Coś poszło nie tak" — użytkownik traci cały kontekst aplikacji.

**Naprawa:** Owinąć każdy lazy-loaded komponent we własny `<ErrorBoundary fallback={<TabSkeleton />}>`:
```tsx
<ErrorBoundary fallback={<div className="p-4 text-text-muted">Błąd ładowania modułu</div>}>
  <Suspense fallback={<Skeleton />}>
    <WorkoutLogger ... />
  </Suspense>
</ErrorBoundary>
```

---

## 🟢 OK — Weryfikacje negatywne (brak problemów)

| Klasa | Status |
|-------|--------|
| `setInterval` bez `clearInterval` | ✅ Wszystkie 3 użycia prawidłowo sprzątają |
| `addEventListener` bez `removeEventListener` | ✅ Wszystkie 14 eventów ma cleanup |
| `new Date().toISOString().split('T')[0]` w src/ | ✅ Brak — `src/lib/date.ts` używa `Intl.DateTimeFormat` z Warsaw TZ |
| SQL race conditions (read-modify-write) | ✅ Używa atomowych RPC i UPDATE col = col + 1 |
| Inline object deps w useEffect (infinite loop) | ✅ Brak jawnych inline `{}` lub `[]` w deps array |
| Brak Error Boundary w ogóle | ✅ ErrorBoundary istnieje, ale zbyt szeroka (patrz M5) |
| `vanguard_stream` indeks na `fingerprint` | ✅ Istnieje (`idx_vanguard_stream_fingerprint`) |
| `vanguard_stream` indeks na `valid_until` | ✅ Istnieje (`idx_vanguard_stream_validity`) |
| Widoki friction z security_invoker | ✅ Naprawione w migracji `20260611150000` |

---

## Priorytet napraw

| # | ID | Opis | Priorytet |
|---|----|------|-----------|
| 1 | C1 | Hardcoded Garmin credentials | 🔴 CRITICAL |
| 2 | C2 | `strava_activities_clean` — utrata security_invoker | 🔴 CRITICAL |
| 3 | C3 | `strain_correlations` — brak security_invoker | 🔴 CRITICAL |
| 4 | H1 | 10× frontend fetch bez AbortSignal | 🟠 HIGH |
| 5 | H2 | DST w statsApi + MuscleHeatmap | 🟠 HIGH |
| 6 | H4 | Brak indeksu `created_at` na `vanguard_stream` | 🟠 HIGH |
| 7 | H3 | Sprint anchor midnight DST | 🟠 HIGH |
| 8 | M1 | Python bare dict access | 🟡 MEDIUM |
| 9 | M2 | todoUtils midnight DST | 🟡 MEDIUM |
| 10 | M3 | useNudgeData day count DST | 🟡 MEDIUM |
| 11 | M4 | e2e-daily-loop DST | 🟡 MEDIUM |
| 12 | M5 | ErrorBoundary zbyt szeroka | 🟡 MEDIUM |
