# AGENTS.md

Entry point for AI agents working in this repository.

## Quick map (read first)

- **Live daily loop:** user stream via `vanguard-telegram` → noon `vanguard-eval-interview` ("Wywiad") → evening `vanguard-daily-reconciliation` reflection. Tomorrow planning is app/Oracle-led, not Telegram evening planning. Autonomous morning brief/ping and legacy midday check are removed.
- **Evidence:** `vanguard_stream` → `vanguard-auto-classify` → `friction_events` → `confirmed_friction_events` (VIEW)
- **Compiled memory:** `vanguard-architect` / `ingest-vault-log` build graph; `vanguard-wiki-compiler` builds derived wiki pages — not inline Oracle chat writes to evidence
- **Function registry (SSOT):** [`supabase/functions/README.md`](supabase/functions/README.md)
- **One-page architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Agent context map:** [`docs/agent/README.md`](docs/agent/README.md) indexes router/memory files; it does not override this constitution.
- **Product language:** [`docs/PRODUCT_LANGUAGE.md`](docs/PRODUCT_LANGUAGE.md) is the canonical vocabulary for UI/docs/agents.

## Konstytucja (non-negotiable)

1. **System measures behavior. User gives meaning.** Evidence layer ≠ reasoning layer. System mierzy tarcie (friction), odzyskiwanie (recovery) oraz rozpoznaje powtarzalne stany (spirals/momentum).
2. **One write path for friction & recovery:** `vanguard_stream` → `vanguard-auto-classify` only.
3. **Extend, don’t duplicate:** new features plug into existing handlers / README-listed functions — no parallel Telegram clients, no second classify pipeline, no Oracle writes to graph/knowledge on chat turns.
4. **Current-first:** stream 72h beats archive; patterns need explicit N — system może wyciągać wnioski o stanie/trajectory, jeśli opiera je na twardych danych historycznych.
5. **Do not build:** shadow engine, psychoanalytic coaching, undeclared “digital twin” certainty, **ani mechanizmu, w którym system autonomicznie orzeka, że „manifestacja/intencja zadziałała”** (metafizyczna pewność). Deklarowane intencje (modlitwy, afirmacje, cele) są DOZWOLONE jako warstwa **deklaracji** do konfrontacji z zachowaniem (Outcome Continuity). Wiążący jest „Transurfing Layer Guardrail” w [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md), nie blankietowy zakaz.

Full guardrails: [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md)

**Wizja długoterminowa (10/10):** [`docs/VISION_10_10.md`](docs/VISION_10_10.md) — zunifikowany, prywatny kokpit samoobserwacji i logowania.

## What this repo is

Monorepo for **Vanguard** (personal OS) on a Supabase project configured through environment variables.

Local/Supabase sync: **32** edge functions (+ `_shared/`). Registry: [`supabase/functions/README.md`](supabase/functions/README.md). Last verified: **2026-06-12**.

| Subsystem | Purpose | Key paths |
|---|---|---|
| Vanguard Core | Daily loop, stream, oracle, planning, Telegram | `supabase/functions/vanguard-*` |
| Integrations | Oura, Calendar, Strava | `supabase/functions/sync-*`, `supabase/functions/analyze-*` |
| Legacy workout | Original fitness tracking UI/tables | `src/` + `workout_*` tables |

## CRITICAL RULES

```
Deploy:
- Cron/webhook functions MUST deploy with verify_jwt: false (--no-verify-jwt)
- Affected: vanguard-midday-check,
  vanguard-daily-reconciliation,
  vanguard-oracle, vanguard-auto-classify, vanguard-architect,
  vanguard-wiki-compiler,
  ingest-vault-log,
  vanguard-analyst, save-daily-aggregate, vanguard-weekly-synthesis,
  vanguard-eval-interview, vanguard-nutrition-coach,
  sync-strava, analyze-training-load
- After deploy: `npm run smoke` (or `node scripts/ops/smoke-vanguard.mjs --with-service-role`) + edge logs — no 401

Telegram:
- Vanguard bot: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

DB constraints (verify before INSERT):
- planning_status: pending | active | completed  (NOT 'done')

Edge function gotchas:
- EdgeRuntime.waitUntil does NOT keep background tasks alive after HTTP response
- Telegram webhook timeout: 30s — long voice processing must be synchronous
- vanguard-telegram is a thin router with handlers; change surgically, one flow at a time
- Do NOT store deploy version numbers in rules/docs — they go stale weekly
```

## Where to read next (order matters)

1. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data flow, crons, subsystems (one page)
2. [`supabase/functions/README.md`](supabase/functions/README.md) — every edge function: status, JWT, tables
3. [`docs/DEV_GUIDE.md`](docs/DEV_GUIDE.md) — conventions, checklists, how to add functions
4. [`docs/agent/README.md`](docs/agent/README.md) — index for router/memory files
5. [`docs/PRODUCT_LANGUAGE.md`](docs/PRODUCT_LANGUAGE.md) — canonical product vocabulary
6. `.cursor/rules/vanguard-agent-workflow.mdc` — definition of done for agents
7. `.cursor/rules/vanguard-context.mdc` — philosophy and epistemic guardrails
8. `.cursor/rules/vanguard-ops.mdc` — deploy, secrets, DB constraints
9. [`BACKLOG.md`](BACKLOG.md) — intentionally deferred work
10. `docs/runbooks/` — incident fixes
11. [`docs/PRODUCT_PRINCIPLES.md`](docs/PRODUCT_PRINCIPLES.md) — full guardrails
12. [`docs/FEATURE_LIFECYCLE.md`](docs/FEATURE_LIFECYCLE.md) — active / disabled / deprecated / dropped map

## Models (current)

- Oracle (default): `deepseek-v4-flash`
- Oracle deep mode (`!!`): `deepseek-reasoner`
- Telegram adversary/planning/emotion inline calls: `deepseek-v4-flash` (in `vanguard-telegram`)
- Transcription: OpenAI Whisper (`whisper-1`)
- Embeddings: OpenAI `text-embedding-3-small`

## Current system state

- Evening reconciliation → planning sessions → plan jutra: **ACTIVE**
- Morning brief/ping + legacy midday check crons: **REMOVED** (functions return 410 stubs); noon interview + evening reflection: **ACTIVE**
- Observation-only mode: **DEPRECATED**
