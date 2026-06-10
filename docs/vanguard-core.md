# Vanguard Core


## Purpose

Capture life in real time → build knowledge graph → AI mirror/coach → evening reconciliation → plan tomorrow.

## Daily loop

```
06:00  vanguard-morning-brief     → plan jutra on Telegram
       ... user streams via Telegram all day ...
12:00  vanguard-midday-check      → inline buttons (done/stuck)
20:00  vanguard-daily-reconciliation → evening summary + day score
       → user responds → planning session starts (Oracle)
       → user says "koniec" → planning_summary saved for tomorrow
```

## Telegram commands (`vanguard-telegram`)

| Input | Mode | Behavior |
|---|---|---|
| plain text / short voice | `stream` | Save to `vanguard_stream`, no reply |
| `?question` | `chat` | Oracle responds |
| `!!question` | `deep` | Oracle with reasoner |
| `##fact` | `knowledge` | Save to `vanguard_knowledge` |
| `@topic` | `report` | Mirror/report mode |
| `Poprawka: ...` | `knowledge` | User correction |
| long voice (>120 words) | `knowledge` | Vault ingest |

During active planning session (`planning_status = active`): all messages go to Oracle planning mode until "koniec"/"done"/"gotowe".

During pending reconciliation (`status = sent`): response saved as day review.

## Key edge functions

| Function | Role |
|---|---|
| `vanguard-telegram` | Webhook hub — stream, oracle, planning, callbacks |
| `vanguard-oracle` | LLM with retrieval + state vector |
| `vanguard-architect` | Stream → entity links / graph |
| `vanguard-auto-classify` | Auto-tag stream entries |
| `vanguard-daily-reconciliation` | Cron: send evening prompt |
| `vanguard-morning-brief` | Cron: send morning plan |
| `vanguard-midday-check` | Cron: midday inline check |

## Key tables

| Table | Purpose |
|---|---|
| `vanguard_stream` | All captured messages/thoughts |
| `vanguard_knowledge` | Verified facts and lessons |
| `vanguard_entity_links` | Knowledge graph edges |
| `daily_reconciliations` | Evening review + planning session + plan jutra |
| `friction_events` | Detected behavioral friction |
| `vanguard_oracle_runs` | Oracle audit log |
| `vanguard_daily_aggregates` | Daily computed state |
| `oura_daily_summary` | Sleep/readiness biometrics |

## State vector (Oracle input)

Oracle receives `state_vector` with:
- biometrics (aggregates + Oura last night)
- discipline (today wins)
- today_plan (from `planning_summary` if exists)

## What not to touch without reason

- Reality Adversary forbidden phrase filter
- Planning tension_action guardrail (reverts to active if missing)
- Stream dedup by `telegram_message_id`
- Confirmed gate / epistemic guardrails in oracle prompts

See [.cursor/rules/vanguard-context.mdc](../.cursor/rules/vanguard-context.mdc) for philosophy.
