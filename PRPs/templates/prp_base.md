name: "Vanguard PRP Template — Context-Rich with Validation Loops"
description: |

## Purpose
Template for implementing features in Vanguard OS (React + Vite frontend, Supabase Edge Functions in Deno/TypeScript, PostgreSQL). AI gets sufficient context to achieve working code through iterative refinement.

## Core Principles
1. **Context is King**: Include ALL necessary docs, caveats, existing patterns
2. **Validation Loops**: Executable build/lint gates the AI can run and fix
3. **Warsaw timezone**: All "today" dates use `toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })`, never `.toISOString().split('T')[0]`
4. **Follow CLAUDE.md**: Global rules always apply

---

## Goal
[What needs to be built — be specific about the end state]

## Why
- [User impact]
- [Integration with existing features]
- [Problem this solves]

## What
[User-visible behavior and technical requirements]

### Success Criteria
- [ ] [Specific measurable outcome]

---

## All Needed Context

### Documentation & References
```yaml
# MUST READ
- file: supabase/functions/_shared/supabase.ts
  why: createServiceClient(), resolveUserScope(), safeExecute() — always use these, never raw createClient()

- file: supabase/functions/_shared/vanguardCore.ts
  why: computeSignals() signature, VANGUARD_STATES

- file: supabase/functions/compute-daily-strain/index.ts
  why: pattern for auth guard via resolveUserScope + Promise.all parallel processing

- file: src/components/biometrics/DailyStrainCard.jsx
  why: pattern for frontend fetch with error propagation (call() throws on !response.ok)

# Add feature-specific references below:
- file: [path/to/related-file]
  why: [pattern to follow]
```

### Stack
```yaml
Frontend:
  - React 18 + Vite, JSX (no TypeScript on frontend)
  - Supabase JS client via src/lib/supabase.js
  - Tailwind CSS
  - State: Zustand (src/store/useStore.js)

Edge Functions:
  - Deno 1.x TypeScript
  - Supabase Edge Runtime
  - Import from _shared/ for shared helpers
  - JWT: verify_jwt: true for user-facing functions, false for cron/service functions

Database:
  - PostgreSQL via Supabase
  - RLS enabled on all tables
  - Warsaw timezone: (now() AT TIME ZONE 'Europe/Warsaw')::date::text in SQL
  - Migrations in supabase/migrations/*.sql
```

### Known Gotchas
```typescript
// CRITICAL: Always use Warsaw timezone, never UTC
// ❌ new Date().toISOString().split('T')[0]
// ✅ new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })

// CRITICAL: Use _shared helpers, never raw clients
// ❌ createClient(url, key)
// ✅ createServiceClient() from _shared/supabase.ts

// CRITICAL: resolveUserScope() for auth — validates JWT vs service role
// Throws on invalid token, returns { userId, isServiceRole }

// CRITICAL: Frontend fetches must throw on !response.ok
// if (!response.ok) { const p = await response.json().catch(() => ({})); throw new Error(p.error || response.status) }

// CRITICAL: computeSignals(oura, todayWin, nutrition, lastTrainingDate) — no stayfreeData
```

### Current Codebase Tree (relevant segment)
```bash
# Run: find src/components -name "*.jsx" | head -30
# Run: ls supabase/functions/
```

---

## Implementation Blueprint

### Data Models / Schema
```typescript
// Describe any new DB columns, RPC args, or TS types needed
```

### Tasks (ordered)
```yaml
Task 1:
  MODIFY supabase/functions/_shared/supabase.ts:
    - [what to add]

Task 2:
  CREATE supabase/functions/new-function/index.ts:
    - MIRROR pattern from: compute-daily-strain/index.ts
    - Auth: resolveUserScope()
    - Warsaw timezone for any date strings

Task 3:
  CREATE supabase/migrations/YYYYMMDDHHMMSS_description.sql:
    - [schema changes]

Task 4:
  MODIFY src/components/<domain>/Component.jsx:
    - [UI changes]

Task N:
  ...
```

### Per-Task Pseudocode
```typescript
// Task N — edge function skeleton
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const { userId } = await resolveUserScope(req, body.userId ?? null)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' })
    // ... logic
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders })
  }
})
```

### Integration Points
```yaml
DATABASE:
  - migration: [describe changes]
  - RLS: enable on new tables

EDGE_FUNCTIONS:
  - JWT: [true / false — why]
  - Add to: scripts/ops/deploy-no-jwt.ps1 (if jwt: false)
  - Add to: supabase/functions/README.md

FRONTEND:
  - New fetch call pattern: use call() helper that throws on !response.ok
  - Error displayed via setError(e.message)
```

---

## Validation Loop

### Level 1: Frontend Build
```bash
# Run from repo root — catches TS/JSX errors and import issues
npm run build
# Expected: ✓ built in X.XXs
# If error: read the Vite output, fix imports/syntax
```

### Level 2: Edge Function Typecheck (optional, Deno needed)
```bash
deno check supabase/functions/new-function/index.ts
# Expected: no errors
```

### Level 3: Manual Integration Test
```bash
# Test edge function with service role key
curl -X POST https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/new-function \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test"}'
# Expected: {"success": true}
```

## Final Validation Checklist
- [ ] `npm run build` passes with no errors
- [ ] Warsaw timezone used for all date strings
- [ ] resolveUserScope() used for auth (not raw JWT parsing)
- [ ] Frontend fetch throws on !response.ok
- [ ] Migration has RLS if new table
- [ ] Function registered in supabase/functions/README.md
- [ ] deploy-no-jwt list updated if jwt: false

---

## Anti-Patterns to Avoid
- ❌ `new Date().toISOString().split('T')[0]` — always UTC, wrong at night in Warsaw
- ❌ Raw `createClient(url, key)` — use `createServiceClient()` from _shared
- ❌ Silent failure (no error state in UI, no 4xx on edge function error)
- ❌ `stayfreeData` / digital load params — removed, columns nullable
- ❌ `computeSignals(stayfree, oura, ...)` — signature changed, first param gone
- ❌ Skipping `user_id` filter on queries — data leak risk
