# Supabase Edge Functions — registry (SSOT)

Project: configured per deployment through environment variables.

**Agents:** If a folder exists here but is missing from this table, or status is not `active` / `manual`, **stop** — update this file first.  
**Architecture:** [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) · **Deploy:** [`AGENTS.md`](../../AGENTS.md) · **Do not build list:** [below](#do-not-build)

> **JWT** = production `verify_jwt`. Cron/webhook/Telegram/Oracle server calls → **`false`** (`--no-verify-jwt` on deploy).

**Inventory:** 34 function folders (+ `_shared/`) · Last registry pass: **2026-06-07**

---

## Data flow (canonical)

```
Telegram / voice / vault
        │
        ▼
  vanguard_stream  ──► vanguard-auto-classify ──► friction_events
        │                      (only friction path)
        ├──► vanguard-architect (batch graph)
        └──► ingest-vault-log (long-form)

Evening: vanguard-daily-reconciliation ──► planning (telegram + oracle) ──► planning_summary
Morning: vanguard-morning-brief ──► vanguard-morning-ping (nudge)
Midday:  vanguard-midday-check (callbacks)

Read: vanguard-oracle, briefing, synthesis, analyst → confirmed_friction_events VIEW, stream 72h first
```

---

## Vanguard Core — daily loop

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-telegram` | **active** | Telegram webhook | **false** | `vanguard_stream`, `daily_reconciliations`, `ai_chat_messages` | 1931 | 2026-05-26 |
| `vanguard-oracle` | **active** | `vanguard-telegram`, frontend | **false** | `vanguard_oracle_runs` (+ read: stream, links, aggregates) | 499 | 2026-05-26 |
| `vanguard-morning-brief` | **active** | pg_cron `0 5 * * *` UTC (~07:00 Warsaw) | **false** | `daily_reconciliations` | 96 | 2026-05-26 |
| `vanguard-morning-ping` | **active** | pg_cron `20 5 * * *` UTC (nudge if no click) | **false** | `daily_reconciliations` | 74 | 2026-05-26 |
| `vanguard-midday-check` | **active** | pg_cron (~12:00 Warsaw — **confirm** `cron.job`) | **false** | `daily_reconciliations` | 95 | 2026-05-26 |
| `vanguard-daily-reconciliation` | **active** | pg_cron (~21:30 Warsaw — **confirm** `cron.job`) | **false** | `daily_reconciliations`, `friction_events` | 194 | 2026-05-26 |
| `vanguard-auto-classify` | **active** | DB trigger / cron on new stream rows | **false** | `vanguard_stream`, `friction_events` | 291 | 2026-05-26 |

### Vanguard Core — evidence & graph

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-architect` | **active** | HTTP batch (`offset`/`limit`) after stream | **false** | `vanguard_entity_links` | 584 | 2026-05-26 |
| `ingest-vault-log` | **active** | HTTP from telegram (long voice / vault) | **false** | `vanguard_stream`, `vanguard_raw_events`, `vanguard_entity_links` | 229 | 2026-05-26 |
| `save-daily-aggregate` | **active** | pg_cron `vanguard-daily-snapshot` `0 4 * * *` UTC | **false** | `vanguard_daily_aggregates` | 155 | 2026-06-07 |

### Vanguard Core — analysis & reports

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-analyst` | **active** | pg_cron `vanguard-daily-analyst` `0 3 * * *` UTC | **false** | `vanguard_stream`, `friction_events`, `vanguard_curiosity_queue` | 240 | 2026-05-26 |
| `vanguard-briefing` | **manual** | HTTP POST `{ userId }` — long LLM briefing to Telegram | true | `user_fundament`, `vanguard_stream`, `friction_events`, aggregates | 219 | 2026-05-26 |
| `vanguard-weekly-synthesis` | **active** | pg_cron Sunday ~17:00 UTC (**confirm** `cron.job`) | **false** | `friction_events`, `vanguard_daily_aggregates`, `vanguard_curiosity_queue`, `vanguard_stream` | 197 | 2026-05-26 |
| `vanguard-friction-qa` | **active** | pg_cron periodic QA (**confirm** schedule) | **false** | `vanguard_stream`, `friction_events` | 149 | 2026-05-26 |
| `vanguard-intentions-cleanup` | **deprecated (410)** | cron usunięty 2026-05-29 (`20260603000001`) — łamał Transurfing Guardrail (auto `manifested`). Zastąpione blokiem [DEKLAROWANE INTENCJE] w Oracle | **false** | — | 41 | 2026-05-29 |

> **`vanguard-briefing` vs `vanguard-morning-brief`:**  
> - **morning-brief** = krótki start dnia na Telegram (cron, plan z `planning_summary`).  
> - **briefing** = długi raport LLM na żądanie (HTTP + `userId`), nie zastępuje morning-brief.

### Vanguard Core — manual / tooling

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-eval-runner` | **manual** | HTTP batch eval vs oracle | **false** | `vanguard_eval_*` | 291 | 2026-05-26 |
| `vanguard-graph-embedder` | **manual** | HTTP one batch per call; repeat until `remaining=0` | **false** | `vanguard_entity_links` | 91 | 2026-05-26 |
| `vanguard-backfill` | **manual** | HTTP embeddings/history backfill | true | `vanguard_stream`, `vanguard_knowledge` | 97 | 2026-05-26 |
| `vanguard-debug-retrieval` | **manual** | HTTP debug RAG retrieval | true | `vanguard_knowledge`, `vanguard_entity_links` | 56 | 2026-05-26 |

### Vanguard Core — deprecated

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `vanguard-reset-prompt` | **deprecated** | Any HTTP → **410 Gone**; cron unscheduled | **false** | — | ~35 | 2026-05-26 |

Do not schedule, extend, or deploy except to keep 410 stub. Delete folder after 30 days with no invocations.

---

## `vanguard-telegram` handler map

Edit **one handler per change**. Webhook entry is a thin router (~35 LOC).

| Area | Path | Role |
|------|------|------|
| Webhook entry | `index.ts` | Parse payload, auth `chat_id`, dispatch |
| Callback router | `_router/callbacks.ts` | Button clicks → handlers |
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

## Practice Dojo (isolated)

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `dojo-telegram` | **disabled** | 410 stub | **false** | — | 14 | 2026-06-07 |
| `dojo-scheduler` | **disabled** | 410 stub | **false** | — | 14 | 2026-06-07 |

**Never** import `vanguard-*` from `dojo-*`. Separate secrets: `DOJO_TELEGRAM_*`.

---

## Integrations

| Function | Status | Trigger | JWT | Key tables | LOC | Verified |
|----------|--------|---------|-----|------------|-----|----------|
| `sync-strava` | **active** | pg_cron `30 20 * * *` UTC (22:30 Warsaw) / manual | **false** | `strava_activities`, `strava_tokens` | 182 | 2026-05-26 |
| `analyze-training` | **active** | HTTP POST | **false** | `training_plan_workouts`, `strava_activities_clean` | 172 | 2026-05-26 |
| `sync-oura` | **active** | Frontend / manual | true | `oura_daily_summary` | 155 | 2026-05-26 |
| `sync-oura-enhanced` | **active** | Frontend / manual | true | `oura_enhanced`, `user_settings` | 207 | 2026-06-07 |
| `sync-oura-timeseries` | **active** | Frontend / manual | true | `oura_heartrate`, `oura_sleep_*`, `oura_activity_met_timeline`, `oura_workouts`, `oura_sessions` | 208 | 2026-06-07 |
| `sync-yazio` | **active** | Frontend / manual | true | `daily_nutrition`, `daily_food_entries` | 144 | 2026-05-26 |
| `analyze-food-quality` | **active** | Frontend / manual LLM analysis | true | `daily_food_entries`, `daily_nutrition` | 177 | 2026-06-07 |
| `compute-daily-strain` | **active** | Frontend / manual derived body score | true | `daily_strain`, Oura/Yazio/Strava/workout tables | 231 | 2026-06-07 |
| `sync-calendar` | **active** | Frontend / manual | true | `vanguard_calendar` | 143 | 2026-05-26 |
| `sync-todoist` | **active** | Frontend / manual | true | `user_settings` | 132 | 2026-05-26 |
| `sync-google-fit` | **deprecated** | Frontend / manual | true | (Google Fit tables) | 120 | 2026-05-26 |
| `google-fit-auth` | **deprecated** | 410 stub | **false** | — | 18 | 2026-06-07 |

> `sync-google-fit` + `google-fit-auth` — superseded by Strava. UI section removed from `Stats.jsx` (2026-05-26). No active callers. Delete-candidate: confirm no manual usage, then remove function folders.

---

## `_shared/` helpers (kernel)

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

Flat layout: one folder = one deployed function name (except `vanguard-telegram/_handlers`).

---

## pg_cron index (migrations)

| Job name | UTC cron | Target |
|----------|----------|--------|
| `vanguard-daily-snapshot` | `0 4 * * *` | `save-daily-aggregate` |
| `vanguard-daily-analyst` | `0 3 * * *` | `vanguard-analyst` |
| `vanguard-morning-brief` | `0 5 * * *` | `vanguard-morning-brief` |
| `vanguard-morning-ping` | `20 5 * * *` | `vanguard-morning-ping` |

Also verify: [`scripts/ops/cron-check.sql`](../../scripts/ops/cron-check.sql) against [`scripts/ops/smoke-manifest.mjs`](../../scripts/ops/smoke-manifest.mjs).  
Post-deploy smoke: `npm run smoke` — see [`docs/runbooks/post-deploy-smoke.md`](../../docs/runbooks/post-deploy-smoke.md).

Removed: `vanguard-daily-shadow-analysis` (duplicate analyst), `vanguard-reset-prompt` cron, `vanguard-weekly-intentions-cleanup` (auto `manifested` — łamał Transurfing Guardrail).

---

## Do not build

Without explicit user approval + PRODUCT_PRINCIPLES feature gate:

- Second friction pipeline (architect/telegram/oracle writing `friction_events`)
- Oracle auto-save to `vanguard_knowledge` / `vanguard_entity_links` on chat
- Shadow engine, manifestation tracker, pendulum detector
- Parallel `fetch(api.telegram.org/...)` outside `_shared/telegram.ts`
- `EdgeRuntime.waitUntil` for DB writes that must complete before HTTP 200
- HTTP **200** with `{ error }` on failure
- Mixing Dojo and Vanguard bots/secrets/tables

---

## Deploy checklist

1. Status in this table = `active` or `manual` (not `deprecated`)
2. `verify_jwt` matches trigger column
3. Deploy; cron/webhook → `--no-verify-jwt`
4. Logs: no **401** within 5 minutes
5. Telegram: one test message on touched flows

See [`docs/runbooks/`](../../docs/runbooks/).
