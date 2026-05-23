# Scripts

One-off and local automation. Not part of the deployed daily loop — see `supabase/functions/` for production code.

| Script | Purpose | How to run |
|---|---|---|
| `import_curriculum.ts` | Load `setter.yaml` → `dojo_curricula` table | `deno run --allow-read --allow-env --allow-net scripts/import_curriculum.ts` (add `--dry` to preview) |
| `run_eval.js` | Batch runner for `vanguard-eval-runner` edge function | `node scripts/run_eval.js` |
| `backfill_triads.js` | Retroactive `vanguard-architect` backfill over stream | `node scripts/backfill_triads.js` |
| `closure_proposals_review.sql` | Review pending stream closure proposals | Run in Supabase SQL editor |
| `telegram-bridge.cjs` | **Legacy** local Telegram polling bridge (pre-webhook) | `node scripts/telegram-bridge.cjs` |
| `aw-bridge.cjs` | Sync ActivityWatch buckets → Supabase (local port 5601) | `node scripts/aw-bridge.cjs` |
| `run-bridge.vbs` | Windows launcher for `aw-bridge.cjs` | **Stale path** — points at old `kuba-workout` repo; fix or delete before use |

Env vars: prefer `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or anon key where sufficient). Several older scripts still hardcode keys — migrate to env before reuse.
