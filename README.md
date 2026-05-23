# Vanguard

Personal operating system: health data, daily stream, knowledge graph, AI coaching, evening planning — plus **Practice Dojo** (30-day voice training).

Supabase project: `pdvqkgfsqziqlhptatgf` · Frontend: React + Vite · Deploy: Vercel

## Subsystems

| Subsystem | What it does | Entry points |
|---|---|---|
| **Vanguard Core** | Telegram bot, stream, oracle, reconciliation, planning | `supabase/functions/vanguard-*` |
| **Practice Dojo** | Separate Telegram bot, voice drills, curriculum | `supabase/functions/dojo-*`, `setter.yaml` |
| **Integrations** | Oura, Yazio, Calendar, Todoist, Google Fit | `supabase/functions/sync-*` |
| **Legacy workout** | Original fitness tracking | `src/` + `workout_*` tables |

## Quick links

### AI agents
- [AGENTS.md](./AGENTS.md) — start here
- [.cursor/rules/vanguard-context.mdc](./.cursor/rules/vanguard-context.mdc) — philosophy
- [.cursor/rules/vanguard-ops.mdc](./.cursor/rules/vanguard-ops.mdc) — deploy rules

### Operations
- [supabase/functions/README.md](./supabase/functions/README.md) — edge functions map
- [docs/DEV_GUIDE.md](./docs/DEV_GUIDE.md) — how to develop: conventions, checklists, rules
- [docs/runbooks/](./docs/runbooks/) — incident fixes

### Deep context
- [docs/PRODUCT_PRINCIPLES.md](./docs/PRODUCT_PRINCIPLES.md) — full guardrails
- [docs/vanguard-core.md](./docs/vanguard-core.md) — daily loop + telegram
- [docs/legacy/](./docs/legacy/) — older docs (may be stale)

## Daily loop (Vanguard)

```
Morning brief → stream all day → midday check → evening reconciliation → planning session → plan jutra
```

## Practice Dojo (separate)

```
/start → Day 0 baseline → Rep A/B → transfer → Day 1+ LLM evaluation
```

Dojo uses its **own Telegram bot** — see [docs/practice-dojo.md](./docs/practice-dojo.md).

## Dev

```bash
npm install
npm run dev
```
