# Supabase Edge Functions registry (SSOT)

Project: configured per deployment through environment variables.

**Agents:** If a folder exists here but is missing from this table, or status is not `active` / `manual`, **stop** and update this file first.
**Architecture:** [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) · **Deploy:** [`AGENTS.md`](../../AGENTS.md) · **Do not build list:** [below](#do-not-build)

> **JWT** = production `verify_jwt`. Cron/webhook/Telegram/Oracle server calls use **`false`** (`--no-verify-jwt` on deploy).

**Inventory:** 30 function folders (+ `_shared/`) · Last registry pass: **2026-06-11**

LOC is a navigation hint, not an invariant. Regenerate before relying on it for refactor sizing.

---

## Data flow (canonical)

```text
Telegram / voice / vault
  -> vanguard_stream -> vanguard-auto-classify -> friction_events
       |                    (only friction path)
       +-> vanguard-architect (batch graph)
       +-> ingest-vault-log (long-form)

Evening: vanguard-daily-reconciliation -> planning (telegram + oracle) -> planning_summary
Morning: autonomous brief/ping removed; morning planning is user-initiated via Telegram/Oracle.
Midday:  vanguard-midday-check (callbacks)

Read: vanguard-oracle, briefing, synthesis, analyst -> confirmed_friction_events VIEW, stream 72h first
```

---

## Vanguard Core Daily Loop

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-telegram` | **active** | Telegram webhook | **false** | `vanguard_stream`, `daily_reconciliations`, `ai_chat_messages` | 2966 | 2026-06-11 |
| `vanguard-oracle` | **active** | `vanguard-telegram`, frontend | **false** | `vanguard_oracle_runs`, `vanguard_stream` (+ read: stream, links, aggregates) | 683 | 2026-06-11 |
| `vanguard-morning-brief` | **deprecated** | HTTP POST returns 410; cron removed | **false** | none | 24 | 2026-06-12 |
| `vanguard-morning-ping` | **deprecated** | HTTP POST returns 410; cron removed | **false** | none | 24 | 2026-06-12 |
| `vanguard-midday-check` | **active** | pg_cron (~12:00 Warsaw; confirm `cron.job`) | **false** | `daily_reconciliations` | 123 | 2026-06-11 |
| `vanguard-daily-reconciliation` | **active** | pg_cron (~21:30 Warsaw; confirm `cron.job`) | **false** | `daily_reconciliations`, `friction_events` | 213 | 2026-06-11 |
| `vanguard-auto-classify` | **active** | DB trigger / cron on new stream rows | **false** | `vanguard_stream`, `friction_events` | 332 | 2026-06-11 |

### Vanguard Core Evidence and Graph

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-architect` | **active** | HTTP batch (`offset`/`limit`) after stream | **false** | `vanguard_entity_links` | 642 | 2026-06-11 |
| `ingest-vault-log` | **active** | HTTP from telegram (long voice / vault) | **false** | `vanguard_stream`, `vanguard_raw_events`, `vanguard_entity_links` | 227 | 2026-06-11 |
| `save-daily-aggregate` | **active** | pg_cron `vanguard-daily-snapshot` `0 4 * * *` UTC | **false** | `vanguard_daily_aggregates` | 161 | 2026-06-11 |

### Vanguard Core Analysis and Reports

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-analyst` | **active** | pg_cron `vanguard-daily-analyst` `0 3 * * *` UTC | **false** | `vanguard_stream`, `friction_events`, `vanguard_curiosity_queue` | 387 | 2026-06-11 |
| `vanguard-briefing` | **manual** | HTTP POST `{ userId }`; long LLM briefing to Telegram | true | `user_fundament`, `vanguard_stream`, `friction_events`, aggregates | 235 | 2026-06-11 |
| `vanguard-weekly-synthesis` | **active** | pg_cron Sunday ~17:00 UTC (confirm `cron.job`) | **false** | `friction_events`, `vanguard_daily_aggregates`, `vanguard_curiosity_queue`, `vanguard_stream` | 223 | 2026-06-11 |
| `vanguard-friction-qa` | **deprecated** | HTTP POST returns 410; cron removed; no Telegram | **false** | none | 24 | 2026-06-12 |

> **Morning note:** autonomous morning brief/ping Telegram nudges were removed 2026-06-12 after repeated "weak plan" spam. Keep morning planning user-initiated unless explicitly re-approved.

### Vanguard Core Manual / Tooling

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-eval-runner` | **manual** | HTTP batch eval vs oracle | **false** | `vanguard_eval_*` | 309 | 2026-06-11 |
| `vanguard-eval-interview` | **active** | pg_cron `vanguard-eval-interview` Mon-Fri `0 10 * * 1-5` UTC (12:00 Warsaw) | **false** | `vanguard_eval_results`, `vanguard_eval_runs`, `vanguard_stream` | 199 | 2026-06-11 |
| `vanguard-graph-embedder` | **manual** | HTTP one batch per call; repeat until `remaining=0` | **false** | `vanguard_entity_links` | 160 | 2026-06-11 |
| `vanguard-backfill` | **manual** | HTTP embeddings/history backfill | true | `vanguard_stream`, `vanguard_knowledge` | 71 | 2026-06-11 |
| `vanguard-debug-retrieval` | **manual** | HTTP debug RAG retrieval | true | `vanguard_knowledge`, `vanguard_entity_links` | 38 | 2026-06-11 |

## `vanguard-telegram` Handler Map

Edit **one handler per change**. Webhook entry is a thin router (~35 LOC). The full Telegram subsystem is no longer small; keep changes handler-scoped and avoid broad rewrites.

| Area | Path | Role |
|------|------|------|
| Webhook entry | `index.ts` | Parse payload, auth `chat_id`, dispatch |
| Callback router | `_router/callbacks.ts` | Button clicks -> handlers |
| Message pipeline | `_router/messages.ts` | Stream, voice, Oracle, planning/recon routing |
| Config | `_router/config.ts` | `createTelegramContext()` |
| Planning | `_handlers/planning.ts` | Oracle planning mode, `planning_summary` |
| Reconciliation | `_handlers/reconciliation.ts` | Evening reply, open planning |
| Feedback buttons | `_handlers/feedback.ts` | `fb_ok` / `fb_err` |
| Morning callbacks | `_handlers/morning.ts` | Start 90 / minimum buttons |
| Midday callbacks | `_handlers/midday.ts` | done / stuck |
| Saturday check-in | `_handlers/saturdayCheckin.ts` | Weekly integration flow |
| Anti-analysis guard | `_handlers/antiAnalysis.ts` | Analysis drift buttons |
| Telegram API | `_shared/telegram.ts` | send, callbacks, getFile (no raw `fetch` in handlers) |

---

## Integrations

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `sync-strava` | **active** | pg_cron `30 20 * * *` UTC (22:30 Warsaw) / manual | **false** | `strava_activities`, `strava_tokens` | 552 | 2026-06-11 |
| `analyze-training` | **deprecated** | HTTP POST returns 410 | **false** | none | 24 | 2026-06-11 |
| `sync-oura` | **active** | Frontend / manual | true | `oura_daily_summary` | 151 | 2026-06-11 |
| `sync-oura-enhanced` | **active** | Frontend / manual | true | `oura_enhanced`, `user_settings` | 207 | 2026-06-11 |
| `sync-oura-timeseries` | **active** | Frontend / manual | true | `oura_heartrate`, `oura_sleep_*`, `oura_activity_met_timeline`, `oura_workouts`, `oura_sessions` | 208 | 2026-06-11 |
| `sync-yazio` | **active** | Frontend / manual | true | `daily_nutrition`, `daily_food_entries` | 178 | 2026-06-11 |
| `analyze-food-quality` | **active** | Frontend / manual LLM analysis | true | `daily_food_entries`, `daily_nutrition` | 447 | 2026-06-11 |
| `compute-daily-strain` | **active** | Frontend / manual derived body score | true | `daily_strain`, Oura/Yazio/Strava/workout tables | 238 | 2026-06-11 |
| `analyze-training-load` | **active** | Frontend / manual LLM analysis | **false** | `daily_strain`, `workout_sessions`, `strava_activities_clean`, `training_plan_workouts` | 409 | 2026-06-11 |
| `sync-calendar` | **active** | Frontend / manual | true | `vanguard_calendar` | 137 | 2026-06-11 |
| `sync-todoist` | **active** | Frontend / manual | true | `user_settings` | 102 | 2026-06-11 |

---

## `_shared/` Helpers (Kernel)

| Module | Exports | Use when |
|--------|---------|----------|
| `supabase.ts` | `createServiceClient`, `safeExecute`, `requireEnv`, `resolveUserScope` | **All** DB access and user-token scope checks |
| `constants.ts` | `getVanguardUserId` | Single-user default ID |
| `time.ts` | `getWarsawDateString`, `getWarsawDayBoundaries`, `getStreamCutoffs` | Warsaw day ranges |
| `streamContext.ts` | `fetchBriefingStreamLayers`, `fetchOracleStreamSlices`, formatters | Stream context (current-first) |
| `telegram.ts` | `sendMessage`, `sendMessageParsed`, `answerCallbackQuery`, `clearInlineKeyboard`, `getTelegramFilePath`, `sendChatAction` | All Telegram Bot API from functions |
| `deepseek.ts` | `deepseekChat`, `parseJsonFromContent` | New DeepSeek calls |
| `vanguardCore.ts` | `VanguardCore`, `computeSignals` | `save-daily-aggregate`, frontend |

**Optional next:** adopt `deepseek.ts` in analyst/architect/ingest (reduce duplicate DeepSeek HTTP).

Frontend/Core boundary: `src/lib/aiContext.js` is the sanctioned read bridge from the legacy frontend into Vanguard Core context; `src/lib/vanguardCore.js` is the sanctioned shared-signals bridge. Do not add new ad hoc frontend reads into Core tables without documenting the boundary here and in `PROJECT_MAP.md`.

Flat layout: one folder = one deployed function name (except `vanguard-telegram/_handlers`).

---

## pg_cron Index (Migrations)

| Job name | UTC cron | Target |
|----------|----------|--------|
| `vanguard-daily-snapshot` | `0 4 * * *` | `save-daily-aggregate` |
| `vanguard-daily-analyst` | `0 3 * * *` | `vanguard-analyst` |
| `vanguard-eval-interview` | `0 10 * * 1-5` | `vanguard-eval-interview` (Mon-Fri, 12:00 Warsaw) |

Also verify: [`scripts/ops/cron-check.sql`](../../scripts/ops/cron-check.sql) against [`scripts/ops/smoke-manifest.mjs`](../../scripts/ops/smoke-manifest.mjs).
Post-deploy smoke: `npm run smoke`; see [`docs/runbooks/post-deploy-smoke.md`](../../docs/runbooks/post-deploy-smoke.md).

---

## Do Not Build

Without explicit user approval + PRODUCT_PRINCIPLES feature gate:

- Second friction pipeline (architect/telegram/oracle writing `friction_events`)
- Oracle auto-save to `vanguard_knowledge` / `vanguard_entity_links` on chat
- Shadow engine, manifestation tracker, pendulum detector
- Parallel `fetch(api.telegram.org/...)` outside `_shared/telegram.ts`
- `EdgeRuntime.waitUntil` for DB writes that must complete before HTTP 200
- HTTP **200** with `{ error }` on failure

---

## Deploy Checklist

1. Status in this table = `active` or `manual` (not `deprecated`)
2. `verify_jwt` matches trigger column
3. Deploy; cron/webhook -> `--no-verify-jwt`
4. Logs: no **401** within 5 minutes
5. Telegram: one test message on touched flows

See [`docs/runbooks/`](../../docs/runbooks/).
