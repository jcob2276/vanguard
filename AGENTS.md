# AGENTS.md

Entry point for AI agents working in this repository.

## What this repo is

Monorepo for **Vanguard** (personal OS) and **Practice Dojo** (30-day voice training), both on Supabase project `pdvqkgfsqziqlhptatgf`.

Local ↔ Supabase sync: 28 functions local = 28 deployed. Last verified: 2026-05-23.

| Subsystem | Purpose | Key paths |
|---|---|---|
| Vanguard Core | Daily loop, stream, oracle, planning, Telegram | `supabase/functions/vanguard-*` |
| Practice Dojo | Voice drills, curriculum, evaluation | `supabase/functions/dojo-*`, `setter.yaml` |
| Integrations | Oura, Yazio, Calendar, Todoist, Google Fit | `supabase/functions/sync-*` |
| Legacy workout | Original fitness tracking UI/tables | `src/` + `workout_*` tables |

## CRITICAL RULES

```
Deploy:
- Cron/webhook functions MUST deploy with verify_jwt: false (--no-verify-jwt)
- Affected: vanguard-morning-brief, vanguard-midday-check,
  vanguard-daily-reconciliation, vanguard-intentions-cleanup,
  weekly-report, vanguard-telegram, dojo-telegram, dojo-scheduler,
  vanguard-oracle, vanguard-auto-classify, vanguard-architect,
  ingest-vault-log, vanguard-friction-qa, vanguard-reset-prompt
- After deploy: check edge function logs for 401 errors

Isolation:
- Vanguard Core and Practice Dojo share one Supabase project
- They are SEPARATE systems — never mix logic, secrets, or bot handlers
- Vanguard bot: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
- Dojo bot: DOJO_TELEGRAM_BOT_TOKEN, DOJO_TELEGRAM_CHAT_ID

DB constraints (verify before INSERT):
- planning_status: pending | active | completed  (NOT 'done')
- dojo_reps.status: pass | partial | repeat_day | pending | diagnostic | self_check
- dojo_reps.rep_type: rep_a | rep_b | correction_rep_a | real_life_transfer

Edge function gotchas:
- EdgeRuntime.waitUntil does NOT keep background tasks alive after HTTP response
- Telegram webhook timeout: 30s — long voice processing must be synchronous
- vanguard-telegram is a monolith — change surgically, one flow at a time
- Do NOT store deploy version numbers in rules/docs — they go stale weekly
```

## Where to read next

1. `.cursor/rules/vanguard-context.mdc` — system philosophy and epistemic guardrails
2. `.cursor/rules/vanguard-ops.mdc` — deploy rules, secrets, DB constraints
3. `.cursor/rules/dojo-isolation.mdc` — Practice Dojo boundary rules
4. `supabase/functions/README.md` — all edge functions mapped
5. `docs/runbooks/` — operational fixes from past incidents
6. `docs/PRODUCT_PRINCIPLES.md` — full guardrails document
7. `docs/legacy/` — older context (verify against current state before trusting)

## Models (current)

- Oracle (default): `deepseek-v4-flash`
- Oracle deep mode (`!!`): `deepseek-reasoner`
- Dojo eval: `deepseek-chat`
- Telegram adversary/planning/emotion inline calls: `deepseek-v4-flash` (in `vanguard-telegram`)
- Transcription: OpenAI Whisper (`whisper-1`)
- Embeddings: OpenAI `text-embedding-3-small`

## Current system state

- Evening reconciliation → planning sessions → plan jutra: **ACTIVE**
- Morning brief + midday check crons: **ACTIVE**
- Practice Dojo: **ACTIVE** (separate Telegram bot)
- Observation-only mode: **DEPRECATED**
