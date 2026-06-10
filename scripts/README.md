# Scripts

One-off and local automation. Not part of the deployed daily loop — see `supabase/functions/` for production code.

| Script | Purpose | How to run |
|---|---|---|
| `smoke-vanguard.mjs` | Post-deploy: edge functions must not return **401** (JWT) | `npm run smoke` or `node scripts/smoke-vanguard.mjs --with-service-role` |
| `ops/deploy-no-jwt.ps1` | Deploy all cron/webhook functions with `--no-verify-jwt` | `.\scripts\ops\deploy-no-jwt.ps1` |
| `ops/cron-check.sql` | Compare live `cron.job` vs manifest | Supabase SQL Editor |
| `ops/smoke-manifest.mjs` | SSOT: no-verify-jwt list + cron expectations | imported by smoke script |
| `run_eval.js` | Batch runner for `vanguard-eval-runner` edge function | `node scripts/run_eval.js` |
| `backfill_triads.js` | Retroactive `vanguard-architect` backfill over stream | `node scripts/backfill_triads.js` |
| `closure_proposals_review.sql` | Review pending stream closure proposals | Run in Supabase SQL editor |
| `aw-bridge.cjs` | Sync ActivityWatch buckets → Supabase (local port 5601) | `node scripts/aw-bridge.cjs` |

Env vars: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or anon key where sufficient). Scripts fail fast with a clear error if required env vars are missing.
