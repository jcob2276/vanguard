# Supabase Edge Functions

Project: `pdvqkgfsqziqlhptatgf`

> JWT column reflects **production** setting. Cron/webhook functions must have `verify_jwt: false`.

## Vanguard Core

| Function | Purpose | Trigger | JWT | Key tables |
|---|---|---|---|---|
| `vanguard-telegram` | Main Telegram bot: stream, oracle, reconciliation, planning | Telegram webhook | **false** | `vanguard_stream`, `daily_reconciliations`, `ai_chat_messages` |
| `vanguard-oracle` | LLM brain: chat, planning, mirror, deep reasoning | Invoked by telegram / frontend | **false** | `vanguard_oracle_runs`, `vanguard_knowledge` |
| `vanguard-architect` | Extract entities/relations from stream → graph | Invoked after stream insert | **false** | `vanguard_entity_links`, `vanguard_knowledge` |
| `vanguard-analyst` | Pattern analysis over stream/graph | Cron | **false** | `vanguard_stream`, `friction_events` |
| `vanguard-auto-classify` | Classify stream entries | DB trigger / cron | **false** | `vanguard_stream` |
| `vanguard-briefing` | Generate daily briefing | Manual / cron | true | `vanguard_daily_aggregates`, `oura_daily_summary` |
| `vanguard-morning-brief` | Send morning plan summary to Telegram | pg_cron | **false** | `daily_reconciliations` |
| `vanguard-midday-check` | Midday progress check with inline buttons | pg_cron | **false** | `daily_reconciliations` |
| `vanguard-daily-reconciliation` | Evening summary + ask for day review | pg_cron | **false** | `daily_reconciliations`, `friction_events` |
| `vanguard-friction-qa` | QA friction event classification | Cron | **false** | `friction_events` |
| `vanguard-reset-prompt` | Periodic prompt/context reset | Cron | **false** | — |
| `vanguard-intentions-cleanup` | Clean stale intentions | Cron | **false** | `vanguard_intentions` |
| `vanguard-backfill` | Backfill historical data | Manual | true | various |
| `vanguard-debug-retrieval` | Debug knowledge retrieval | Manual | true | `vanguard_knowledge` |
| `vanguard-eval-runner` | Run eval harness against oracle | Manual / cron | **false** | `vanguard_eval_*` |
| `vanguard-graph-embedder` | Embed graph entities | Manual | **false** | `vanguard_entity_links` |
| `ingest-vault-log` | Long-form vault/knowledge ingest | Invoked by telegram | **false** | `vanguard_knowledge` |
| `save-daily-aggregate` | Save daily state aggregate | Cron / manual | **false** | `vanguard_daily_aggregates` |

## Practice Dojo

| Function | Purpose | Trigger | JWT | Key tables |
|---|---|---|---|---|
| `dojo-telegram` | Dojo bot: voice reps, state machine, eval | Telegram webhook | **false** | `dojo_runs`, `dojo_reps`, `dojo_curricula` |
| `dojo-scheduler` | Morning/afternoon drill reminders | pg_cron | **false** | `dojo_runs`, `dojo_curricula` |

## Integrations

| Function | Purpose | Trigger | JWT | Key tables |
|---|---|---|---|---|
| `sync-oura` | Sync Oura Ring data | Frontend / cron | true | `oura_daily_summary` |
| `sync-yazio` | Sync Yazio nutrition | Frontend / cron | true | `daily_nutrition`, `daily_food_entries` |
| `sync-calendar` | Sync Google Calendar | Frontend / cron | true | `vanguard_calendar` |
| `sync-todoist` | Sync Todoist tasks | Frontend / cron | true | `user_settings` |
| `sync-google-fit` | Sync Google Fit | Frontend / cron | true | — |
| `google-fit-auth` | Google Fit OAuth | HTTP | **false** | — |

## Legacy / reports

| Function | Purpose | Trigger | JWT |
|---|---|---|---|
| `weekly-report` | Weekly summary report | Cron | **false** |

## Shared helpers

```
supabase/functions/_shared/
├── telegram.ts    # sendMessage, sendChatAction, escapeMd
├── deepseek.ts    # deepseekChat, parseJsonFromContent
└── supabase.ts    # createServiceClient()
```

Import: `import { sendMessage } from '../_shared/telegram.ts'`

```
_shared/ adopted: vanguard-morning-brief, vanguard-midday-check, dojo-telegram
Pending migration: vanguard-telegram, vanguard-auto-classify
```

> Functions live in a flat folder layout (no subfolders by domain). If that changes, update this note.

## Deploy checklist

1. Confirm `verify_jwt` setting matches this table for the target function
2. Deploy via Supabase CLI or MCP `deploy_edge_function`
3. Check logs for 401 within 5 minutes
4. For telegram functions: send test message

See `docs/runbooks/deploy-edge-function.md`
