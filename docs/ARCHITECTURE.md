# Vanguard OS — Architecture (current)

> **Source of truth for agents:** behavior and deploy live in `AGENTS.md` and `supabase/functions/README.md`.  
> This file is the **one-page map**: data flow, crons, subsystems.  
> Do **not** implement from `docs/legacy/` without verifying against the files above.

Supabase project: `pdvqkgfsqziqlhptatgf`

---

## Subsystems

| Subsystem | Role | Paths |
|-----------|------|--------|
| **Vanguard Core** | Daily loop, stream, friction, Oracle, planning | `supabase/functions/vanguard-*` |
| **Practice Dojo** | Voice training (separate bot) | `dojo-telegram`, `dojo-scheduler`, `setter.yaml` |
| **Integrations** | Oura, Yazio, Calendar, Todoist, Strava | `sync-*` (Google Fit deprecated) |
| **Legacy workout** | Fitness UI + workout tables | `src/`, `workout_*` tables (`weekly-report` function nie istnieje — ghost z wczesnych planów) |

**Isolation:** Dojo and Vanguard share one Supabase project but **must not** share bot handlers, secrets, or business logic. See `.cursor/rules/dojo-isolation.mdc`.

---

## Data flow (canonical)

```
Telegram / voice / manual ingest
        │
        ▼
  vanguard_stream          ← only raw user evidence (source of truth)
        │
        ├──► vanguard-auto-classify  → friction_events
        │         (canonical friction pipeline; NOT architect)
        │
        ├──► vanguard-architect (batch) → vanguard_entity_links (graph)
        │
        └──► ingest-vault-log (long-form) → stream chunks + graph RPC

READ path: Oracle, briefing, synthesis, analyst
         → confirmed_friction_events VIEW for patterns
         → current-first: stream 72h > archive

WRITE path (evening): daily_reconciliations → planning (telegram + oracle)
                   → planning_summary for tomorrow

Morning: morning-brief / morning-ping → daily_reconciliations
Midday:  midday-check → callbacks on same row
```

**Rules agents must not break:**

1. **Evidence ≠ reasoning** — LLM does not write facts to `vanguard_knowledge` / `entity_links` from Oracle chat (disabled by design).
2. **One friction pipeline** — `stream` → `auto-classify` only; do not re-enable friction extraction in architect.
3. **Extend, don’t duplicate** — new behavior = new handler or one edge function + README row, not a parallel Telegram fetch or second classify path.

---

## Daily loop (Warsaw-oriented)

| Local (approx.) | Edge function | Effect |
|-----------------|---------------|--------|
| ~07:00 | `vanguard-morning-brief` | Start message + plan buttons |
| ~07:20 | `vanguard-morning-ping` | Nudge if no morning click |
| ~12:00 | `vanguard-midday-check` | Inline done / stuck |
| ~21:30 | `vanguard-daily-reconciliation` | Evening voice/text prompt |
| (after reply) | `vanguard-telegram` + `vanguard-oracle` | Planning session → `planning_summary` |

User input all day: `vanguard-telegram` (`index.ts` router → `_router/messages.ts` / `_handlers/*`) → `vanguard_stream` (most messages silent save; `?` / `!!` → Oracle).

Detail: [vanguard-core.md](./vanguard-core.md)

---

## pg_cron jobs (from migrations + docs)

**SSOT for expected jobs:** [`scripts/ops/smoke-manifest.mjs`](../scripts/ops/smoke-manifest.mjs) (`CRON_FROM_MIGRATIONS`, `CRON_DASHBOARD_ONLY`, `CRON_REMOVED`).

Verify live: [`scripts/ops/cron-check.sql`](../scripts/ops/cron-check.sql) or `SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;`

| Job name (migration) | Schedule (UTC) | Edge function / target |
|----------------------|----------------|-------------------------|
| `vanguard-daily-snapshot` | `0 4 * * *` | `save-daily-aggregate` (per user) |
| `vanguard-morning-brief` | `0 5 * * *` | `vanguard-morning-brief` |
| `vanguard-morning-ping` | `20 5 * * *` | `vanguard-morning-ping` |
| `vanguard-weekly-intentions-cleanup` | `0 0 * * 0` (Sun) | `vanguard-intentions-cleanup` |

**Documented in README / ops, confirm in dashboard:**

| Function | Typical trigger |
|----------|-----------------|
| `vanguard-midday-check` | pg_cron (~midday Warsaw) |
| `vanguard-daily-reconciliation` | pg_cron (~evening Warsaw) |
| `vanguard-weekly-synthesis` | pg_cron Sunday ~17:00 UTC |
| `vanguard-friction-qa` | periodic QA report |
| `dojo-scheduler` | `0 6 * * *` / `0 13 * * *` UTC (see function header) |
| ~~`weekly-report`~~ | ❌ ghost — function folder does not exist |

Deprecated: `vanguard-reset-prompt` → HTTP **410** (cron off; `20260526100000_unschedule_reset_prompt.sql`).  
Removed duplicate cron: `vanguard-daily-shadow-analysis` (`20260525170000_evaluation_fixes.sql`).

---

## Key tables (minimal)

| Table | Role |
|-------|------|
| `vanguard_stream` | Raw entries (Telegram, voice, system) |
| `friction_events` | Extracted friction atoms |
| `confirmed_friction_events` | VIEW — confirmed/good only |
| `daily_reconciliations` | Evening row + planning + morning/midday metadata |
| `vanguard_entity_links` | Knowledge graph edges |
| `vanguard_daily_aggregates` | Daily biometric/state snapshot |
| `vanguard_oracle_runs` | Oracle audit log (read-only telemetry) |
| `user_fundament` | Identity / philosophy (context, not live truth) |

---

## Edge function kernel (`supabase/functions/_shared/`)

| Module | Purpose |
|--------|---------|
| `supabase.ts` | `createServiceClient()` — **only** way to open DB in functions |
| `constants.ts` | `getVanguardUserId()` |
| `time.ts` | Warsaw date + day boundaries + stream cutoffs (24h/72h/21d) |
| `streamContext.ts` | Shared stream fetch/format for Oracle + briefing |
| `telegram.ts` | Outbound Telegram (not webhook file download) |
| `vanguardCore.ts` | Daily aggregate signals (mirrors `src/lib/vanguardCore.js`) |

New code should import these instead of duplicating `createClient` or stream queries.

---

## Edge functions registry

**Full list (status, JWT, tables, LOC, handler map):** [`supabase/functions/README.md`](../supabase/functions/README.md) — **29 functions**, last pass 2026-05-26.

Do not add or deploy a function that is not listed there with status `active` or `manual`.

---

## Agent read order (15 min onboarding)

1. `AGENTS.md` — constitution + deploy rules  
2. `supabase/functions/README.md` — every function  
3. This file — flow + crons  
4. `docs/DEV_GUIDE.md` — how to change code  
5. `docs/PRODUCT_PRINCIPLES.md` — language and epistemic guardrails  
6. `BACKLOG.md` — do not fix what is intentionally deferred  

Skip for implementation: `docs/legacy/*` (history only).

---

## What we do not build (constitution)

- Shadow engine / brutal provocation  
- System auto-orzekający „manifestacja zadziałała” / pendulum detector (intencja jako **deklaracja** do konfrontacji — TAK; jako mechanizm magii / auto-status — NIE; patrz „Transurfing Layer Guardrail” w PRODUCT_PRINCIPLES)  
- Oracle auto-writing to graph or `vanguard_knowledge` on every turn  
- Second friction pipeline in architect or telegram  
- “Confirmed pattern” language without explicit N  

See `docs/PRODUCT_PRINCIPLES.md` for the full gate.
