name: "SleepDebtCard — cumulative 7-day sleep debt widget"
confidence: 9/10

## Goal
Build `src/components/SleepDebtCard.jsx` — a Body-view card showing cumulative sleep debt
over the last 7 days from `oura_daily_summary`, with trend vs previous 7 days, avg sleep
score, colour-coded status ring, and a refresh button that triggers `sync-oura`.

Mount it in `src/components/Dashboard.jsx` in the `body` view, directly below `DailyStrainCard`
and above `Stats`.

## Why
- User already has Oura data (`oura_daily_summary`) but no aggregate debt view
- DailyStrainCard shows today's strain; SleepDebtCard shows multi-day sleep pattern
- Completes the Body panel: Strain → Sleep Debt → Stats → OuraWidget

## What

### Visual layout
```
┌─────────────────────────────────────────┐  ← border colour = status
│ DŁUG SNU 7 DNI          Trend ↑/↓       │
│                                         │
│  3h 20min          Avg score: 78        │
│  ████████░░░░░░░░  (debt bar, max=8h)   │
│                                         │
│ [provisional notice if < 5 days data]   │
│                                  [⟳]    │
└─────────────────────────────────────────┘
```

Status:
- 🟢 green  — debt < 60 min  (border-emerald-500/40, bg-emerald-500/10)
- 🟡 yellow — debt 60–180 min (border-amber-500/40,   bg-amber-500/10)
- 🔴 red    — debt > 180 min  (border-red-500/50,      bg-red-500/10)

Trend (vs previous 7 days):
- Improving (↑, emerald)  → debtNow < debtPrev
- Worsening (↓, red)      → debtNow > debtPrev
- Stable   (→, neutral)   → |difference| < 30 min

---

## All Needed Context

### Key files to read before implementing

```yaml
- file: src/components/DailyStrainCard.jsx
  why: >
    Exact pattern to follow: STATUS_RING/STATUS_GLOW maps, Metric sub-component,
    refresh() with call() helper, loading/error/empty states, border-radius/shadow/
    gradient CSS classes. Mirror this file's structure closely.

- file: src/components/OuraWidget.jsx
  why: >
    Shows exactly how oura_daily_summary is queried (lines 41-57).
    CRITICAL: table column is `total_sleep_hours` (float, hours) NOT `total_sleep_duration`.
    Warsaw timezone pattern: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })

- file: examples/frontend-component.jsx
  why: Canonical fetchRow / call() / loading+error+empty render pattern

- file: src/components/Dashboard.jsx  lines 373-393
  why: Mount point — body view, insert SleepDebtCard between DailyStrainCard and Stats
```

### oura_daily_summary schema (confirmed from OuraWidget.jsx)
```
user_id             uuid
date                text  'YYYY-MM-DD'
total_sleep_hours   float   ← use THIS, not total_sleep_duration
sleep_score         int     0-100
readiness_score     int
hrv_avg             float
rhr_avg             float
```

### Calculation logic
```js
const GOAL_HOURS = 8          // 480 min target
const GOAL_MIN   = 480

// For each row: debt contribution = max(0, GOAL_MIN - actual_min)
// actual_min = Math.round(row.total_sleep_hours * 60)

// Fetch 14 rows ordered by date DESC
// rows[0..6]  → current 7 days  → debtNow, avgScore
// rows[7..13] → previous 7 days → debtPrev (trend)

function calcDebt(rows) {
  return rows.reduce((sum, r) => {
    const min = Math.round((r.total_sleep_hours || 0) * 60)
    return sum + Math.max(0, GOAL_MIN - min)
  }, 0)
}
```

### Status mapping (copy from DailyStrainCard pattern)
```js
const STATUS_RING = {
  green:  'border-emerald-500/40',
  yellow: 'border-amber-500/40',
  red:    'border-red-500/50',
}
const STATUS_GLOW = {
  green:  'bg-emerald-500/10',
  yellow: 'bg-amber-500/10',
  red:    'bg-red-500/10',
}

function debtStatus(debtMin) {
  if (debtMin < 60)  return 'green'
  if (debtMin < 180) return 'yellow'
  return 'red'
}
```

### Debt display format
```js
function formatDebt(min) {
  if (min <= 0) return '0 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}
```

### Trend component
```jsx
function Trend({ debtNow, debtPrev }) {
  if (debtPrev === null) return null
  const diff = debtNow - debtPrev
  if (Math.abs(diff) < 30) return <span className="text-white/40">→</span>
  if (diff < 0) return <span className="text-emerald-400">↑ lepiej</span>  // less debt = better
  return <span className="text-red-400">↓ gorzej</span>
}
```

### Refresh — call() pattern (from DailyStrainCard.jsx lines 87-122)
```js
async function refresh() {
  setRefreshing(true)
  setError(null)
  try {
    const { data: { session: s } } = await supabase.auth.getSession()
    const token = s?.access_token
    const base = import.meta.env.VITE_SUPABASE_URL
    const call = async (fn, body) => {
      const res = await fetch(`${base}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const p = await res.json().catch(() => ({}))
        throw new Error(`${fn} failed: ${p.error || res.statusText || res.status}`)
      }
      return res
    }
    await call('sync-oura', { userId: session.user.id })
    await fetchData()
  } catch (e) {
    console.error('SleepDebtCard refresh:', e)
    setError(e.message || 'Refresh failed')
  } finally {
    setRefreshing(false)
  }
}
```

### Warsaw date for 14-day window
```js
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
const cutoff = new Date(Date.now() - 14 * 864e5)
  .toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
// query: .gte('date', cutoff).lte('date', today)
```

---

## Implementation Tasks (ordered)

### Task 1 — Create `src/components/SleepDebtCard.jsx`

Structure:
```
imports: { useState, useEffect } from react
         { supabase } from '../lib/supabase'
         { Moon, RefreshCw } from 'lucide-react'
         DataStateNotice from './DataStateNotice'

constants: GOAL_MIN=480, STATUS_RING, STATUS_GLOW

helpers: calcDebt(rows), formatDebt(min), debtStatus(min)

sub-component: Trend({ debtNow, debtPrev })

export default SleepDebtCard({ session }):
  state: rows=null, loading=true, error=null, refreshing=false

  fetchData():
    today = Warsaw date
    cutoff = Warsaw date 14 days ago
    query oura_daily_summary
      .select('date, total_sleep_hours, sleep_score')
      .eq('user_id', session.user.id)
      .gte('date', cutoff)
      .lte('date', today)
      .order('date', { ascending: false })
      .limit(14)
    setRows(data)

  useEffect → fetchData() on session.user.id change

  refresh() → call('sync-oura', { userId }) → fetchData()

  derived (computed from rows):
    week  = rows.slice(0, 7)      // most recent 7
    prev  = rows.slice(7, 14)     // previous 7
    debtNow  = calcDebt(week)
    debtPrev = prev.length >= 5 ? calcDebt(prev) : null
    avgScore = avg of week[].sleep_score filtered non-null
    status   = debtStatus(debtNow)
    barPct   = min(debtNow / (8 * 60) * 100, 100)   // max bar = 8h debt

  render loading/error/empty states with DataStateNotice

  happy path:
    <section className={`... border ${STATUS_RING[status]} bg-[linear-gradient(...)]`}>
      <div absolute glow ${STATUS_GLOW[status]} />
      header: "Dług snu 7 dni" + <Trend debtNow debtPrev />  + <RefreshCw refresh button>
      main value: formatDebt(debtNow)
      sub-label: "Avg sen: {avgScore}/100" if avgScore
      debt bar: width={barPct}%
      notice if week.length < 5: DataStateNotice "Niepełne dane — mniej niż 5 dni Oura"
    </section>
```

### Task 2 — Mount in `src/components/Dashboard.jsx`

1. Import at top: `import SleepDebtCard from './SleepDebtCard';`

2. In body view (around line 376), insert between DailyStrainCard and Stats:
```jsx
{view === 'body' && (
  <section className="space-y-5">
    <SectionHeader ... />
    <DailyStrainCard session={session} />
    <SleepDebtCard session={session} />   {/* ← ADD THIS */}
    <Stats ... />
  </section>
)}
```

---

## Validation Loop

### Level 1: Build must pass
```bash
npm run build
# Expected: ✓ built in X.XXs — no errors
# Common failure: wrong import path, missing prop, JSX syntax error
```

### Level 2: Visual check
Open app → Body tab → verify:
- SleepDebtCard appears between DailyStrainCard and Stats
- Status ring colour matches debt level
- Trend arrow visible if 14 days data available
- Refresh button spins during sync
- Error message appears if sync-oura fails

---

## Final Checklist
- [ ] `npm run build` passes
- [ ] `total_sleep_hours` used (NOT `total_sleep_duration`)
- [ ] Warsaw timezone for date range calculation
- [ ] `.eq('user_id', session.user.id)` on query
- [ ] `call()` throws on `!response.ok`
- [ ] Loading / error / empty states all handled
- [ ] Mounted in Dashboard.jsx body view
- [ ] Debt bar capped at 100% (8h max)
- [ ] Trend only shown when prev period has >= 5 rows

## Anti-Patterns to Avoid
- ❌ `total_sleep_duration` — column doesn't exist, use `total_sleep_hours`
- ❌ UTC date: `new Date().toISOString().split('T')[0]`
- ❌ Missing `user_id` filter on query
- ❌ Swallowing fetch error (no throw on !response.ok)
- ❌ Crash when 0 Oura rows — show DataStateNotice instead
