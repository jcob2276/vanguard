# Vanguard OS — Architecture (current)

> **Source of truth for agents:** behavior and deploy live in `AGENTS.md` and `supabase/functions/README.md`.  
> This file is the **one-page map**: data flow, crons, subsystems.  

Supabase project: configured per deployment through environment variables.

---

## Subsystems

| Subsystem | Role | Paths |
|-----------|------|--------|
| **Vanguard Core** | Daily loop, stream, friction, Oracle, planning | `supabase/functions/vanguard-*` |
| **Integrations** | Oura, Calendar, Strava, derived analysis | `supabase/functions/sync-*`, `supabase/functions/analyze-*`, `compute-daily-strain` |
| **Projects & Todo** | Native projects and separate task surfaces | `src/components/projects`, `src/components/todo`, `projects`, `todo_*` tables |
| Legacy workout | Existing workout UI/data model | `src/`, `workout_*` tables |
| **Behavior capture map** | Where each behavior type is logged (SSOT: `src/lib/behaviorCapture.ts`) | Desktop `BehaviorCapturePanel`, Telegram commands |

### Top-level directories

| Path | Purpose |
|---|---|
| `supabase/functions/` | Deno Edge Functions — CRONs, webhooks, AI logic. Each folder is one deployed function. |
| `supabase/migrations/` | Applied SQL migrations. Immutable. |
| `src/` | React 19 SPA — data visualization, timelines, specialized panels. |
| `docs/` | Knowledge base (this file, `PRODUCT_PRINCIPLES.md`, `DEV_GUIDE.md`, `FRONTEND_GUIDE.md`). |
| `scripts/` | Local ops automation, eval scripts, testing (`scripts/ops/`). |

### Frontend directory map (`src/`)

| Path | Purpose |
|---|---|
| `components/cards/` | Atomic timeline/Memex building blocks — `entities/` (person, place, link), `quantifiable/` (metric, mood, progress), `temporal/` (event, routine, task), `textual/` (article, insight_summary), `visual/` (canvas, video, snapshot). Type Registry pattern, see `FRONTEND_GUIDE.md` §10 Wzorzec B. |
| `components/desktop/` | Multi-column cockpit dashboard (`DesktopDashboard`, `SprintMetricsGrid`, `SmartAlerts`, `MarathonPanel`). |
| `components/growth/` | Skill tree, interventional learning, life experiments (`GrowthVault`, `SkillTreePanel`). |
| `components/lifestyle/` | PowerList, direction radar, goal tracking. |
| `components/medical/` | Lab results, biology scores, trend charts. |
| `components/stats/` | Cross-domain analytics (workout history, body metrics, food analysis). |
| `components/insights/` / `projects/` / `todo/` / `schedule/` | Domain-specific views. |
| `widgets/` | Reusable charts and specialized visual components. |
| `components/ui/` | Design system primitives — see `DESIGN_SYSTEM.md`. |
| `lib/` | Frontend API clients (`*Api.ts`), parsers, domain logic. See `FRONTEND_GUIDE.md` §11 for folder-threshold rule. |
| `hooks/` | React state over `lib/` — fetch orchestration, side effects, browser APIs. |

**Runtime boundaries:** `supabase/functions/_shared/` is the single source of truth for backend logic — frontend must not duplicate scoring/calculation logic that already lives there. Never commit secrets; use `.env.local` for edge function testing.

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
        ├──► vanguard-wiki-compiler → vanguard_wiki_pages (derived compiled memory)
        │
        └──► ingest-vault-log (long-form) → stream chunks + graph RPC

READ path: Oracle, synthesis, analyst
         → confirmed_friction_events VIEW for patterns
         → vanguard_wiki_pages for high-level compiled memory
         → current-first: stream 72h > archive

WRITE path (evening): daily_reconciliations -> reflection response
Planning path: app/Oracle writes planning_summary; Telegram evening no longer plans tomorrow

Morning: autonomous brief/ping removed; user-initiated Telegram/Oracle only
Noon: vanguard-eval-interview sends reflective "Wywiad" question
Evening: vanguard-daily-reconciliation summarizes 24h voice/stream and asks reflection questions
```

**Rules agents must not break:**

1. **Evidence ≠ reasoning** — LLM does not write facts to `vanguard_knowledge` / `entity_links` from Oracle chat (disabled by design).
2. **One friction pipeline** — `stream` → `auto-classify` only; do not re-enable friction extraction in architect.
3. **Extend, don’t duplicate** — new behavior = new handler or one edge function + README row, not a parallel Telegram fetch or second classify path.

---

## Daily loop (Warsaw-oriented)

| Local (approx.) | Edge function | Effect |
|-----------------|---------------|--------|
| ~12:00 | `vanguard-eval-interview` | Reflective interview / thread-connecting question |
| ~21:30 | `vanguard-daily-reconciliation` | 24h reflection prompt |
| manual | `/koniec` in `vanguard-telegram` | Starts same reflection early; evening cron skips |

User input all day: `vanguard-telegram` (`index.ts` router → `_router/messages.ts` / `_handlers/*`) → `vanguard_stream` (most messages silent save; `?` / `!!` → Oracle).

### Telegram input modes (`vanguard-telegram`)

| Input | Mode | Behavior |
|---|---|---|
| plain text / short voice | `stream` | Save to `vanguard_stream`, no reply |
| `?question` | `chat` | Oracle responds |
| `!!question` | `deep` | Oracle with reasoner |
| `##fact` | `knowledge` | Save to `vanguard_knowledge` |
| `@topic` | `report` | Mirror/report mode |
| `Poprawka: ...` | `knowledge` | User correction |
| long voice (>120 words) | `knowledge` | Vault ingest |

During active planning session (`planning_status = active`): all messages go to Oracle planning mode until "koniec"/"done"/"gotowe". During pending reconciliation (`status = sent`): response saved as day review.

### What not to touch without reason

- Planning `tension_action` guardrail (reverts to active if missing).
- Stream dedup by `telegram_message_id`.
- Confirmed gate / epistemic guardrails in Oracle prompts.

See [.cursor/rules/vanguard-context.mdc](../.cursor/rules/vanguard-context.mdc) for philosophy.

---

## pg_cron jobs (from migrations + docs)

**SSOT for expected jobs:** [`scripts/ops/smoke-manifest.mjs`](../scripts/ops/smoke-manifest.mjs) (`CRON_FROM_MIGRATIONS`, `CRON_DASHBOARD_ONLY`, `CRON_REMOVED`).

Verify live: [`scripts/ops/cron-check.sql`](../scripts/ops/cron-check.sql) or `SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;`

| Job name (migration) | Schedule (UTC) | Edge function / target |
|----------------------|----------------|-------------------------|
| `vanguard-daily-snapshot` | `0 4 * * *` | `save-daily-aggregate` (per user) |
| `vanguard-daily-analyst` | `0 3 * * *` | `vanguard-analyst` |
| `vanguard-wiki-compiler` | `20 3 * * *` | `vanguard-wiki-compiler` (derived compiled memory) |
| `vanguard-sync-strava` | `30 20 * * *` | `sync-strava` |
| `vanguard-eval-interview` | `0 10 * * 1-5` | `vanguard-eval-interview` |
| `vanguard-nutrition-coach` | `0 6 * * *` | `vanguard-nutrition-coach` |
| `rescore-workout-sessions` | `20 11 * * *` | `rescore-workout-sessions` |
| `compute-illness-signal` | `25 11 * * *` | `compute-illness-signal` |

**Documented in README / ops, confirm in dashboard:**

| Function | Typical trigger |
|----------|-----------------|
| `vanguard-daily-reconciliation` | pg_cron (~evening Warsaw) |
| `vanguard-weekly-synthesis` | pg_cron Sunday ~17:00 UTC |

Removed crons: `vanguard-morning-brief`, `vanguard-morning-ping`, `vanguard-midday-check`, `vanguard-daily-briefing`, `vanguard-friction-qa-daily`, `vanguard-daily-shadow-analysis`, legacy intentions cleanup/reset prompt jobs.

---

## Key tables (minimal)

| Table | Role |
|-------|------|
| `vanguard_stream` | Raw entries (Telegram, voice, system) |
| `friction_events` | Extracted friction atoms |
| `confirmed_friction_events` | VIEW — confirmed/good only |
| `daily_reconciliations` | Evening row + planning + morning/midday metadata |
| `vanguard_entity_links` | Knowledge graph edges |
| `vanguard_wiki_pages` | Derived compiled memory pages (not source-of-truth) |
| `vanguard_wiki_review_items` | Human review queue for weak/stale/conflicting wiki claims |
| `vanguard_daily_aggregates` | Daily biometric/state snapshot |
| `vanguard_oracle_runs` | Oracle audit log (read-only telemetry) |
| `user_fundament` | Identity / philosophy (context, not live truth) |
| `projects` | Canonical project model for the Projekty section |
| `todo_sections`, `todo_items` | Separate task model; `todo_sections.project_id` is only an optional project bridge; milestones = `is_milestone=true` |
| `kpi_entries` | KPI per project per week (auto-rollup from daily_wins via RPC) |
| `sprint_goals`, `sprint_reviews` | Sprint planning and reviews |
| `monthly_reviews` | Monthly close-outs (pattern, leverage, correction) |
| `life_goals` | Long-term goals / BHAG |
| `daily_wins` | PowerList: task_1..5, done_1..5, daily_rpe |

Deprecated/dropped tables (do not use): `career_projects`, `career_moves`, `career_evidence`, `career_decisions` (removed 2026-06-30), `project_checkpoints` (milestones now in `todo_items.is_milestone`), `goals`, `focus_sessions`, `vanguard_intentions`, `vanguard_correlations`, `vanguard_temporal_links`.

**Behavior logging (do not duplicate):**

| What | Canonical table | How to log |
|------|-----------------|------------|
| Free text, friction, context | `vanguard_stream` | Telegram, voice, PowerList, BlockTimer |
| Daily habits incl. Lenie | `habits` + `habit_logs` | Desktop Nawyki, `/lenie` → also mirrors to stream |
| Strength / wellness (sauna) | `workout_sessions` + `exercise_logs` | Workout logger, Sauna modal |
| Confounders (alcohol, stress, illness, travel) | `behavior_log` | Desktop Sygnały dnia |
| Meals / caffeine | `daily_food_entries` | Food logger, Telegram meal |
| Supplements | `supplement_logs` | Telegram `/sup` |
| Friction atoms | `friction_events` | **Derived** from stream via auto-classify only |
| Legacy stretch checkboxes | `daily_habits` | **Deprecated** — no UI; use `habits` instead |

---

## Edge function kernel (`supabase/functions/_shared/`)

| Module | Purpose |
|--------|---------|
| `supabase.ts` | `createServiceClient()` — **only** way to open DB in functions |
| `constants.ts` | `getVanguardUserId()` |
| `time.ts` | Warsaw date + day boundaries + stream cutoffs (24h/72h/21d) |
| `streamContext.ts` | Shared stream fetch/format for Oracle + briefing |
| `telegram.ts` | Outbound Telegram (not webhook file download) |
| `vanguardCore.ts` | Daily aggregate signals (mirrors `src/lib/vanguardCore.ts`) |

New code should import these instead of duplicating `createClient` or stream queries.

---

## Edge functions registry

**Full list (status, JWT, tables, LOC, handler map):** [`supabase/functions/README.md`](../supabase/functions/README.md) — **31 functions** (verify count there before quoting it elsewhere; do not hardcode it in other docs, it goes stale).

Do not add or deploy a function that is not listed there with status `active` or `manual`.

---

## Agent read order

**SSOT:** [`docs/README.md`](./README.md) — kanoniczna kolejność czytania dla agentów.

---

## What we do not build (constitution)

- Shadow engine / brutal provocation  
- System auto-orzekający „manifestacja zadziałała” / pendulum detector (intencja jako **deklaracja** do konfrontacji — TAK; jako mechanizm magii / auto-status — NIE; patrz „Transurfing Layer Guardrail” w PRODUCT_PRINCIPLES)  
- Oracle auto-writing to graph or `vanguard_knowledge` on every turn  
- Second friction pipeline in architect or telegram  
- “Confirmed pattern” language without explicit N  

See `docs/PRODUCT_PRINCIPLES.md` for the full gate.

