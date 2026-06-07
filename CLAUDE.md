# Vanguard OS — Project Rules

## Stack
- **Frontend**: React 18 + Vite, JSX (no TypeScript), Tailwind CSS, Zustand (`src/store/useStore.js`)
- **Edge Functions**: Deno TypeScript, Supabase Edge Runtime (`supabase/functions/`)
- **Database**: PostgreSQL via Supabase, RLS on all tables, migrations in `supabase/migrations/`
- **Shared helpers**: `supabase/functions/_shared/` — always use these, never inline equivalents

## Critical rules — never break these

### 1. Warsaw timezone
```ts
// ✅ CORRECT
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
// In SQL: (now() AT TIME ZONE 'Europe/Warsaw')::date::text

// ❌ WRONG — UTC, breaks at night
const today = new Date().toISOString().split('T')[0]
// In SQL: current_date::text
```

### 2. Supabase client
```ts
// ✅ CORRECT
import { createServiceClient } from "../_shared/supabase.ts"
const supabase = createServiceClient()

// ❌ WRONG — never raw createClient() in edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const supabase = createClient(url, key)
```

### 3. Auth guard in edge functions
```ts
// ✅ CORRECT — validates JWT vs service role key, checks userId ownership
const { userId, isServiceRole } = await resolveUserScope(req, body.userId ?? null)

// ❌ WRONG — raw header parsing bypasses ownership check
const token = req.headers.get('Authorization')?.slice(7)
```

### 4. Frontend fetch — always throw on error
```js
// ✅ CORRECT
const call = async (fn, body) => {
  const res = await fetch(`${base}/functions/v1/${fn}`, { ... })
  if (!res.ok) {
    const p = await res.json().catch(() => ({}))
    throw new Error(`${fn} failed: ${p.error || res.status}`)
  }
  return res
}

// ❌ WRONG — silently swallows errors
const res = await fetch(...)
const data = await res.json()
```

### 5. User ID filter on every DB query
```js
// ✅ CORRECT
supabase.from('table').select('*').eq('user_id', session.user.id)

// ❌ WRONG — returns all users' data
supabase.from('table').select('*')
```

### 6. computeSignals signature (stayfreeData removed)
```ts
// ✅ CORRECT — 4 params
computeSignals(oura, todayWin, nutrition, lastTrainingDate)

// ❌ WRONG — old 5-param version with stayfreeData
computeSignals(stayfreeData, oura, todayWin, nutrition, lastTrainingDate)
```

## Code patterns — follow examples/

| Task | Reference file |
|---|---|
| New edge function | `examples/edge-function.ts` |
| New React component | `examples/frontend-component.jsx` |
| New DB table | `examples/migration.sql` |
| New RPC | `examples/rpc.sql` |

## Edge function deployment

Functions with `verify_jwt: false` (cron / service calls) must be listed in:
- `scripts/ops/deploy-no-jwt.ps1`
- `supabase/functions/README.md`

## Build validation
```bash
npm run build   # must pass before any commit — catches TS/JSX import errors
```

## Deprecated — do not reference
- `stayfreeData` / `dopamine_load_index` / `fragmentation_index` / `screen_time_min` — nullable legacy, no source
- `sync-google-fit`, `google-fit-auth` — replaced by Strava
- `vanguard-intentions-cleanup`, `vanguard-reset-prompt` — deprecated 410 stubs
- `ProgressionTable.jsx`, `WorkoutExecution.jsx`, `useStats.js`, `workoutPlan.js` — deleted
