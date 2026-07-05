# Supabase Edge Functions registry (SSOT)

Project: configured per deployment through environment variables.

**Agents:** If a folder exists here but is missing from this table, or status is not `active` / `manual`, **stop** and update this file first.
**Architecture:** [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) · **Deploy:** [`AGENTS.md`](../../AGENTS.md) · **Do not build list:** [below](#do-not-build)

> **JWT** = production `verify_jwt`. Cron/webhook/Telegram/Oracle server calls use **`false`** (`--no-verify-jwt` on deploy).

**Inventory:** 43 function folders (+ `_shared/`) · Last registry pass: **2026-06-30**

LOC is a navigation hint, not an invariant. Regenerate before relying on it for refactor sizing.

---

## Data flow (canonical)

```text
Telegram / voice / vault
  -> vanguard_stream -> vanguard-auto-classify -> friction_events
       |                    (only friction path)
       +-> vanguard-architect (batch graph)
       +-> ingest-vault-log (long-form)
       +-> vanguard-wiki-compiler (derived compiled wiki)

Noon: vanguard-eval-interview -> reflective interview / thread-connecting question
Evening: vanguard-daily-reconciliation -> 24h voice/stream reflection prompt
Morning: autonomous brief/ping removed; planning is user-initiated in app/Oracle, not Telegram.

Nightly: vanguard-analyst -> RPC sync_friction_proposals -> system_proposals (confirmed friction N>=3 / 7d Warsaw)
Read: vanguard-oracle, briefing, synthesis, analyst -> stream 72h first + confirmed_friction_events VIEW + derived vanguard_wiki_pages
Frontend: Week Hub + Action Center resolve pending system_proposals (Istotne / Olej)
```

---

## Vanguard Core Daily Loop

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-telegram` | **active** | Telegram webhook | **false** | `vanguard_stream`, `daily_reconciliations`, `ai_chat_messages` | 2630 | 2026-06-12 |
| `vanguard-telegram-worker` | **active** | DB trigger on new inbox items | **false** | `vanguard_telegram_inbox` (+ reads/writes relative to vanguard-telegram) | ~90 | 2026-07-01 |
| `vanguard-oracle` | **active** | `vanguard-telegram`, frontend | **false** | `vanguard_oracle_runs`, `vanguard_stream` (+ read: stream, links, aggregates, wiki, medical_* context) | 791 | 2026-06-13 |
| `vanguard-morning-brief` | **dropped** | Deleted from codebase | **false** | none | — | 2026-06-20 |
| `vanguard-morning-ping` | **dropped** | Deleted from codebase | **false** | none | — | 2026-06-20 |
| `vanguard-midday-check` | **dropped** | Deleted from codebase | **false** | none | — | 2026-06-20 |
| `vanguard-daily-reconciliation` | **active** | pg_cron (~21:30 Warsaw; confirm `cron.job`) + manual `/koniec` | **false** | `daily_reconciliations`, `vanguard_stream`, `friction_events` | 219 | 2026-06-12 |
| `vanguard-auto-classify` | **active** | DB trigger / cron on new stream rows | **false** | `vanguard_stream`, `friction_events` | 332 | 2026-06-11 |
| `vanguard-push-reminder` | **manual** | pg_cron every minute | **false** | `todo_items`, `push_subscriptions` | 70 | 2026-06-20 |

### Vanguard Core Evidence and Graph

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-architect` | **active** | HTTP batch (`offset`/`limit`) after stream | **false** | `vanguard_entity_links` | 642 | 2026-06-11 |
| `vanguard-wiki-compiler` | **active** | HTTP/manual or cron candidate; derived wiki compiler | **false** | `vanguard_wiki_pages`, `vanguard_wiki_sources`, `vanguard_wiki_review_items`, `vanguard_wiki_runs` (+ read: stream/friction/reconciliation/aggregates) | 735 | 2026-06-12 |
| `ingest-vault-log` | **active** | HTTP from telegram (long voice / vault) | **false** | `vanguard_stream`, `vanguard_raw_events`, `vanguard_entity_links` | 227 | 2026-06-11 |
| `save-daily-aggregate` | **active** | pg_cron `vanguard-daily-snapshot` `0 4 * * *` UTC | **false** | `vanguard_daily_aggregates` | 161 | 2026-06-11 |

### Vanguard Core Analysis and Reports

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-analyst` | **active** | pg_cron `vanguard-daily-analyst` `0 3 * * *` UTC; RPC `sync_friction_proposals` at start | **false** | `vanguard_stream`, `friction_events`, `vanguard_curiosity_queue`, `system_proposals` (via RPC) | 390 | 2026-06-29 |
| `vanguard-briefing` | **dropped** | Deleted from codebase | true | none | — | 2026-06-20 |
| `vanguard-weekly-synthesis` | **active** | pg_cron Sunday ~17:00 UTC (confirm `cron.job`) | **false** | `friction_events`, `vanguard_daily_aggregates`, `vanguard_curiosity_queue`, `vanguard_stream` | 223 | 2026-06-11 |
| `vanguard-weekly-brief` | **deprecated** | Stubbed 410 — frontend trigger removed 2026-06-30; was WeeklyReview AI summary | true | none | — | 2026-06-30 |
| `vanguard-friction-qa` | **dropped** | Deleted from codebase | **false** | none | — | 2026-06-20 |

> **Noon note:** the useful 12:00 Telegram flow is `vanguard-eval-interview` ("Wywiad"), not the legacy `vanguard-midday-check`.
> **Evening note:** Telegram evening flow is reflection, not tomorrow planning. `/koniec` manually starts the same 24h reflection and the 21:30 cron skips if it already ran.

### Vanguard Core Manual / Tooling

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-eval-runner` | **manual** | HTTP batch eval vs oracle | **false** | `vanguard_eval_*` | 309 | 2026-06-11 |
| `vanguard-eval-interview` | **active** | pg_cron `vanguard-eval-interview` Mon-Fri `0 10 * * 1-5` UTC (12:00 Warsaw) | **false** | `vanguard_eval_results`, `vanguard_eval_runs`, `vanguard_stream` | 199 | 2026-06-11 |
| `vanguard-graph-embedder` | **manual** | HTTP one batch per call; repeat until `remaining=0` | **false** | `vanguard_entity_links` | 160 | 2026-06-11 |
| `vanguard-backfill` | **dropped** | Deleted from codebase | true | none | — | 2026-06-20 |
| `vanguard-debug-retrieval` | **dropped** | Deleted from codebase | true | none | — | 2026-06-20 |
| `vanguard-todo-classify` | **active** | Frontend background task classifier | true | `todo_items` | 117 | 2026-06-14 |
| `vanguard-goal-create` | **active** | Frontend Goal suggestion trigger | true | none (calls DeepSeek only) | 85 | 2026-06-20 |
| `vanguard-task-breakdown` | **active** | Frontend task breakdown trigger | true | none (calls DeepSeek only) | ~60 | 2026-07-03 |
| `parse-food-nl` | **active** | Frontend NL meal parser | true | none (calls DeepSeek only) | 149 | 2026-06-21 |
| `parse-workout-nl` | **active** | Frontend `WorkoutQuickCapture` NL parser | true | `exercise_logs` (read history) | ~75 | 2026-06-26 |
| `lookup-food` | **active** | Frontend `FoodEntryModal` food/barcode search | true | none (external food DB lookup) | 217 | 2026-06-26 |
| `vanguard-detect-patterns` | **active** | Frontend `PatternsView` on-demand | true | `friction_events`, `vanguard_stream` (read) | 453 | 2026-06-26 |
| `vanguard-keep-triage` | **active** | Frontend weekly ritual (Direction tab) | true | `vanguard_notes`, `vanguard_stream` (read/write) | 105 | 2026-06-26 |
| `vanguard-kpi-suggest` | **active** | Frontend weekly ritual (Direction tab) | true | `life_goals`, `projects`, `goal_kpis` (read) | 85 | 2026-06-26 |
| `vanguard-week-recap` | **active** | Frontend `Direction` weekly recap | true | `daily_wins`, `friction_events`, `vanguard_stream` (read) | 430 | 2026-06-26 |
| `vanguard-librarian` | **active** | Manual / cron — resolves `llm_estimate` food entries to `food_library`, notifies via Telegram | **false** | `daily_food_entries`, `food_library`, `food_corrections` | 137 | 2026-06-30 |


## `vanguard-telegram` Handler Map

Edit **one handler per change**. Webhook entry is a thin router (~35 LOC). The full Telegram subsystem is no longer small; keep changes handler-scoped and avoid broad rewrites.

| Area | Path | Role |
|------|------|------|
| Webhook entry | `index.ts` | Parse payload, auth `chat_id`, dispatch |
| Callback router | `_router/callbacks.ts` | Button clicks -> handlers |
| Message pipeline | `_router/messages.ts` | Stream, voice, Oracle, reconciliation routing |
| Config | `_router/config.ts` | `createTelegramContext()` |
| Reconciliation | `_handlers/reconciliation.ts` | Evening reflection reply (Telegram fast path) |
| Feedback buttons | `_handlers/feedback.ts` | `fb_ok` / `fb_err` |
| Anti-analysis guard | `_handlers/antiAnalysis.ts` | Analysis drift buttons |
| Telegram API | `_shared/telegram.ts` | send, callbacks, getFile (no raw `fetch` in handlers) |

---

## Integrations

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `sync-strava` | **active** | pg_cron `30 20 * * *` UTC (22:30 Warsaw) / manual | **false** | `strava_activities`, `strava_tokens` | 552 | 2026-06-11 |
| `analyze-training` | **dropped** | Deleted from codebase | **false** | none | — | 2026-06-20 |
| `sync-oura` | **active** | Frontend / manual | true | `oura_daily_summary` | 151 | 2026-06-11 |
| `sync-oura-enhanced` | **active** | Frontend / manual | true | `oura_enhanced`, `user_settings` | 207 | 2026-06-11 |
| `sync-oura-timeseries` | **active** | Frontend / manual | true | `oura_heartrate`, `oura_sleep_*`, `oura_activity_met_timeline`, `oura_workouts`, `oura_sessions` | 208 | 2026-06-11 |
| `sync-yazio` | **dropped** | Deleted from codebase; nutrition via app food log (`daily_nutrition`, `daily_food_entries`) | true | none | — | 2026-06-26 |
| `analyze-food-quality` | **active** | Frontend / manual LLM analysis | true | `daily_food_entries`, `daily_nutrition` | 447 | 2026-06-11 |
| `compute-daily-strain` | **active** | Frontend / manual derived body score | true | `daily_strain`, Oura/Strava/workout + food log tables | 469 | 2026-06-12 |
| `rescore-workout-sessions` | **active** | pg_cron `20 11 * * *` UTC (after sync-oura-timeseries + compute-daily-strain) | **false** | `workout_sessions` (hr_avg_bpm, hr_peak_bpm, hr_strain_score, hr_kcal_est, hr_rescored_at); reads `oura_heartrate`, `nutrition_profile`, `body_metrics`, `oura_daily_summary` | 165 | 2026-06-24 |
| `compute-correlations` | **active** | Frontend / manual read-only correlation scan | true | `daily_strain`, `oura_daily_summary`, `daily_nutrition` | 237 | 2026-06-12 |
| `compute-illness-signal` | **active** | pg_cron `25 11 * * *` UTC (after compute-daily-strain) | **false** | `daily_strain` (illness_score, illness_level); reads `oura_daily_summary`, `oura_enhanced`, `behavior_log`, `exercise_logs` | 160 | 2026-06-24 |
| `compute-behavior-effects` | **active** | Frontend / manual read-only "What Moves You" (Welch t-test + Cohen's d + dose-response) | true | none (read-only); reads `behavior_log`, `daily_strain` | 187 | 2026-06-24 |
| `compute-recovery-forecast` | **active** | Frontend / manual read-only — wieczorna prognoza recovery na jutro | true | none (read-only); reads `daily_strain` | 100 | 2026-06-24 |
| `compute-weekly-digest` | **active** | Frontend / manual read-only — deterministyczny przegląd tydzień-do-tygodnia | true | none (read-only); reads `daily_strain`, `oura_daily_summary` | 160 | 2026-06-24 |
| `analyze-training-load` | **active** | Frontend / manual LLM analysis | **false** | `daily_strain`, `workout_sessions`, `strava_activities_clean`, `training_plan_workouts` | 798 | 2026-06-12 |
| `vanguard-nutrition-coach` | **active** | pg_cron `0 6 * * *` UTC (08:00 Warsaw) + manual `{ userId?, date?, notify? }` | **false** | `nutrition_profile`, `nutrition_targets` (+ read: `body_metrics`, `daily_nutrition`, `oura_daily_summary`, `strava_activities_clean`, `workout_sessions`, `medical_lab_results`, `medical_documents`, `body_composition_measurements`) | 240 | 2026-06-13 |
| `sync-calendar` | **active** | Frontend / manual | true | `vanguard_calendar` | 137 | 2026-06-11 |
| `calendar-write` | **active** | Frontend / manual | true | `vanguard_calendar` | ~140 | 2026-07-03 |

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

Frontend/Core boundary: `src/lib/aiContext.ts` is the sanctioned read bridge from the legacy frontend into Vanguard Core context; `src/lib/vanguardCore.ts` is the sanctioned shared-signals bridge. Do not add new ad hoc frontend reads into Core tables without documenting the boundary here and in `PROJECT_MAP.md`.

Flat layout: one folder = one deployed function name (except `vanguard-telegram/_handlers`).

---

## pg_cron Index (Migrations)

| Job name | UTC cron | Target |
|----------|----------|--------|
| `vanguard-daily-snapshot` | `0 4 * * *` | `save-daily-aggregate` |
| `vanguard-daily-analyst` | `0 3 * * *` | `vanguard-analyst` |
| `vanguard-wiki-compiler` | `20 3 * * *` | `vanguard-wiki-compiler` |
| `vanguard-sync-strava` | `30 20 * * *` | `sync-strava` |
| `vanguard-eval-interview` | `0 10 * * 1-5` | `vanguard-eval-interview` (Mon-Fri, 12:00 Warsaw) |
| `vanguard-nutrition-coach` | `0 6 * * *` | `vanguard-nutrition-coach` (08:00 Warsaw; daily target + Telegram push) |

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
