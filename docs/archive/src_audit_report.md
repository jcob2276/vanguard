# Angry Dev Audit — `src/` — 2026-06-21

Pełny scan: silent failures, DST, race conditions, resource leaks.
Spec wejściowa: `src_quality_audit.md`.

---

## 🔴 KRYTYCZNE — Silent Failures (dane giną bez błędu w UI)

### K1 · Stats.tsx:174 — `deleteSession()` brak error check
```typescript
await supabase.from('workout_sessions').delete().eq('id', id);
fetchStats(); // woła się zawsze, nawet jeśli delete failed
```
**Efekt:** Trening znika z UI, potem wraca po refresh (dane w DB żyją). User kliknie 3x.

### K2 · Stats.tsx:284 — `deleteLog()` identyczny problem
```typescript
await supabase.from('exercise_logs').delete().eq('id', id);
```

### K3 · DesktopDashboard.tsx:133 — `deleteDream()` brak error check
```typescript
await supabase.from('dreams').delete().eq('id', id);
setDreams(prev => prev.filter(d => d.id !== id)); // natychmiastowy optimistic update
```
**Efekt:** Marzenie znika wizualnie, ale w DB zostaje. Odświeżenie cofnie usunięcie.

### K4 · DesktopDashboard.tsx:186 — `deleteVisionItem()` brak error check
Identyczny wzorzec jak K3.

### K5 · LinksInbox.tsx:194 — `deleteLink()` brak error check
```typescript
await supabase.from('vanguard_links').delete().eq('id', id);
// UI już zaktualizowany zanim dotarliśmy tutaj
```

### K6 · Photos.tsx:76 — `deletePhoto()` brak error check
```typescript
await supabase.from('progress_photos').delete().eq('id', id).eq('user_id', session.user.id);
```

### K7 · WeeklyReview.tsx:123 — `deleteKpi()` brak error check
```typescript
await db.from('goal_kpis').delete().eq('id', id).eq('user_id', uid);
```

### K8 · DailySnapshotCard.tsx:34–70 — Promise.all BEZ `.catch`
```typescript
Promise.all([...query1, query2, query3]).then(([{ data: rec }, ...]) => {
  // jeśli cokolwiek wyrzuci, .then się nie odpali
  // ALE NIE MA .catch — komponent wisi w loading na zawsze
})
```
**Efekt:** Jeden failed request (RLS, timeout, sieć) → cały DailySnapshotCard nie wychodzi z `loading`. Biały element na dashboardzie, zero feedback.

### K9 · useDashboardData.ts:51–65 — Promise.all ignoruje `.error`
```typescript
const [nutritionRes, tDataRes, protDataRes, ...] = await Promise.all([...]);
const nutrition = nutritionRes.data;   // .error IGNOROWANY
const tData = tDataRes.data;           // .error IGNOROWANY
```
**Efekt:** Jedno zapytanie odbija się o RLS timeout → `nutrition = null` → totalCal = 0 → Dashboard pokazuje "0 kcal dzisiaj". User myśli że nie jadł. Błąd ukryty.

### K10 · Todo.tsx:303 — fire-and-forget classify BEZ AbortSignal
```typescript
fetch(`${base}/functions/v1/vanguard-todo-classify`, {
  method: 'POST', headers: {...}, body: JSON.stringify({...}),
  // BRAK signal: AbortSignal.timeout()
}).then(() => setTimeout(fetchAll, 200)).catch(() => {});
```
**Efekt:** Edge Function wisi → `fetchAll` nigdy nie woła → nowe tagi AI nie pojawiają się w UI. User nie wie dlaczego.

### K11 · StravaWidget.tsx:126 — sync-strava BEZ AbortSignal
```typescript
const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-strava`, {
  method: 'POST',
  // BRAK signal
});
```
**Efekt:** Cold start Supabase Edge Function może trwać 10–30s. `setSyncing(true)` wisi na wieczność. Spinner nie znika.

---

## 🟠 ŚREDNIE — DST Drift

### D1 · desktopUtils.ts:23 — `daysBefore()` używa `*86400000`
```typescript
export const daysBefore = (n: number) =>
  formatWarsawDate(new Date(getTodayWarsaw() + 'T12:00:00').getTime() - n * 86400000);
```
Dobra kotwica T12:00:00, ale odejmowanie w ms → w marcu/październiku jeden "dzień" = 23h lub 25h → `daysBefore(7)` może wskazywać 6 lub 8 dni temu.
**Używane w:** wszystkich obliczeniach streak, sprint, tygodniowych statystykach.

### D2 · desktopUtils.ts:104, DesktopDashboard.tsx:359, CockpitBanner.tsx:60, LeniePanelMini.tsx:20 — `Date.now()` vs anchored date
```typescript
Math.floor((Date.now() - new Date(lastS.date + 'T12:00:00').getTime()) / 86400000)
```
`Date.now()` to bieżąca sekunda — licznik dni przeskoczy losowo w ciągu dnia (nie o północy). Powinno być: `new Date(getTodayWarsaw() + 'T12:00:00Z').getTime() - new Date(lastS.date + 'T12:00:00Z').getTime()`.

### D3 · desktopUtils.ts:288–291 — sprint dates via ms arithmetic (84 dni)
```typescript
const sprintStart = new Date(anchor.getTime() + startOffset * 86400000);
const sprintEnd   = new Date(anchor.getTime() + (startOffset + 83) * 86400000);
```
84-dniowy sprint = 2 DST transitions. Błąd kumuluje się do 2h → sprint może zaczynać się "dzień wcześniej" w UI. Fix: `setUTCDate` w pętli lub `addDays` z date-fns (DST-safe).

### D4 · desktopUtils.ts:332 — weekly history loop via ms
```typescript
const wEnd = formatWarsawDate(new Date(cursor.getTime() + 6 * 86400000));
```
W historii tygodniowej `wEnd` przesuwa się o milisekundy, nie o dni UTC.

### D5 · weeklyReviewUtils.ts:52,59,68 — `T00:00:00` bez `Z` (local midnight)
```typescript
const d = new Date(ws + 'T00:00:00'); // browser local timezone!
```
W przeglądarce z timezone Europe/Warsaw to jest OK większość czasu, ale `T00:00:00` to midnight local — jeśli user jest w innej strefie lub przeglądarka ma UTC, wynik jest błędny. Powinno być `T12:00:00Z`.

### D6 · Projects.tsx:120–125 — `T00:00:00` bez `Z`
```typescript
const todayWarsawDate = new Date(getTodayWarsaw() + 'T00:00:00');
const daysLeft = p.deadline ? differenceInDays(new Date(p.deadline + 'T00:00:00'), todayWarsawDate) : null;
```
`date-fns differenceInDays` jest DST-safe jeśli oba daty są UTC, ale `T00:00:00` bez `Z` to local midnight → drift przy deadline.

### D7 · useDashboardData.ts:47 — `T12:00:00` bez `Z`
```typescript
const todayDate = new Date(today + 'T12:00:00'); // brak Z → local timezone
```
Powinno być `T12:00:00Z`.

### D8 · DailySnapshotCard.tsx:30 — `T12:00:00` bez `Z`
```typescript
const todayMs = new Date(today + 'T12:00:00').getTime();
```

---

## 🟡 NISKIE — Silent Mutations bez Error Handling

Poniższe mutacje kończą się cicho — user myśli że zapisano, ale gdy sieć/RLS odrzuci, nie ma żadnego feedbacku:

| # | Plik | Linia | Operacja |
|---|------|-------|----------|
| S1 | DesktopDashboard.tsx | 383 | `sprint_goals.upsert()` — cel sprintu zapisany "w głowę" |
| S2 | DesktopDashboard.tsx | 169 | `projects.update({ dream_id })` — link dream→project niewidoczny |
| S3 | MorningBriefCard.tsx | 81 | `morning_briefs.delete()` — regenerate bez sprawdzenia |
| S4 | CheckpointsCard.tsx | 70 | `project_checkpoints.update(status:'done')` — checkpoint może nie być done |
| S5 | GoalsCard.tsx | 39 | `life_goals.update({ bhag_pillar })` — pillars nie zapisane |
| S6 | Photos.tsx | 61 | `progress_photos.insert()` — zdjęcie nie pojawi się po reload |

---

## 🔵 INNE — Race Conditions & Resource Issues

### R1 · LinksInbox.tsx:191 — `setTimeout(async, 3000)` po unmount
```typescript
setTimeout(async () => {
  await supabase.from('vanguard_links').delete(...)
}, 3000);
```
Jeśli komponent odmountuje się w ciągu 3 sekund (np. user przechodzi do innego taba), setState w callbacku wywoła warning. Nie krytyczne, ale React 18 strict mode to wyrzuci.

### R2 · Todo.tsx:316 — batchClassify bez AbortSignal
```typescript
await Promise.allSettled(unclassified.map((item: any) =>
  fetch(`${base}/functions/v1/vanguard-todo-classify`, {
    // BRAK signal
  })
));
```
50 unclassified items = 50 równoległych fetch bez timeout. Jeden wiszący request blokuje cały batch.

---

## Podsumowanie

| Kategoria | Ile | Priorytet |
|-----------|-----|-----------|
| Silent delete failures | 7 (K1–K7) | 🔴 Fix natychmiast |
| Promise.all bez catch/error | 2 (K8–K9) | 🔴 Fix natychmiast |
| Fetch bez AbortSignal | 2 (K10–K11, R2) | 🔴 Fix |
| DST drift `Date.now()` | 4 (D2) | 🟠 Fix |
| DST drift `*86400000` | 4 (D1,D3,D4) | 🟠 Fix |
| DST `T00:00:00` bez Z | 3 (D5,D6,D7,D8) | 🟠 Fix |
| Silent mutations (niskie ryzyko) | 6 (S1–S6) | 🟡 Fix |
| Race condition po unmount | 1 (R1) | 🟡 Fix |

**Skrypt jest poprawny co do logiki. Umiera na obsłudze błędów asynchronicznych + DST drift w obliczeniach dat.**
