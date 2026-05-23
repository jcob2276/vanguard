# Practice Dojo

30-day behavioral voice training. **Separate from Vanguard Core.**

Bot: `@DigitalTwinKuba_bot` (or configured Dojo bot)
Functions: `dojo-telegram`, `dojo-scheduler`

## Purpose

Deterministic curriculum + voice reps + LLM evaluation against daily constraints. Builds communication baseline on Day 0, trains Days 1–29, final sample Day 30.

## Architecture

```
setter.yaml  →  dojo_curricula (DB)     ← source of truth
                    ↓
              dojo_runs (state machine)
                    ↓
              dojo_reps (evidence per voice note)
                    ↓
              DeepSeek eval (Day 1+ only)
```

## Day phases

Each day:
1. **rep_a** — first voice rep (60–90s)
2. **correction_rep_a** — optional, if eval status = `repeat_day` and trigger != none
3. **rep_b** — second voice rep (90–120s)
4. **real_life_transfer** — real-world task, user sends "done"

## Day 0 (diagnostic)

- **No LLM evaluation** — short-circuit in code
- Rep A → Rep B → compute baseline stats → transfer
- Baseline stored in `dojo_runs.baseline_stats`: words/sec, filler density, avg sentence length

## Day 1–29 (training)

DeepSeek evaluates **primary_constraint only**. Returns:
- Worked / Improve / Next rep (shown to user)
- status: `pass` | `partial` | `repeat_day`

## Telegram commands

| Command | Action |
|---|---|
| `/start` | Create run or show status if active |
| `/status` | Current day, phase, constraint, drill instruction |
| voice note | Process current phase rep |
| `done` / `gotowe` | Complete real_life_transfer |

## Key tables

| Table | Purpose |
|---|---|
| `dojo_curricula` | 30-day curriculum JSONB (from setter.yaml) |
| `dojo_runs` | Active sprint: day, phase, baseline_stats |
| `dojo_reps` | Each voice note: transcript, eval, status |

## DB constraints (critical)

```
dojo_reps.status:   pass | partial | repeat_day | pending | diagnostic | self_check
dojo_reps.rep_type: rep_a | rep_b | correction_rep_a | real_life_transfer
```

## Isolation rules

- Own bot token: `DOJO_TELEGRAM_*`
- Does NOT use Vanguard Oracle
- Does NOT write to `vanguard_stream`
- When editing Vanguard: do not touch `dojo-*` files

See [.cursor/rules/dojo-isolation.mdc](../.cursor/rules/dojo-isolation.mdc).

## Known gotchas

- Voice processing must be **synchronous** (Telegram 30s timeout)
- `EdgeRuntime.waitUntil` does not work for background processing on Supabase
- CHECK constraints caused silent failures — always test INSERT after schema changes

See [runbooks/db-constraint-mismatch.md](./runbooks/db-constraint-mismatch.md).
