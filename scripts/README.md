# Scripts

One-off and local automation. Not part of the deployed daily loop — see `supabase/functions/` for production code.

Layout: `ops/` (deploy, smoke, CI checks), `aw/` (ActivityWatch bridge), `analysis/` (eval + data analysis one-offs).

## ops/ — deploy, smoke, CI

| Script | Purpose | How to run |
|---|---|---|
| `ops/smoke-vanguard.mjs` | Post-deploy: edge functions must not return **401** (JWT) | `npm run smoke` or `node scripts/ops/smoke-vanguard.mjs --with-service-role` |
| `ops/deploy-no-jwt.ps1` | Deploy all cron/webhook functions with `--no-verify-jwt` | `.\scripts\ops\deploy-no-jwt.ps1` |
| `ops/cron-check.sql` | Compare live `cron.job` vs manifest | Supabase SQL Editor |
| `ops/smoke-manifest.mjs` | SSOT: no-verify-jwt list + cron expectations | imported by smoke script |
| `ops/smoke-ui.mjs` | UI smoke check (CI) | `npm run smoke:ui` |
| `ops/check-edge-functions.mjs` | Deno typecheck of all edge functions (CI) | `npm run typecheck` |
| `ops/check-readme-sync.mjs` | README parity with routes, env vars, scripts, links, and Edge Function references | `npm run audit:readme` |
| `ops/oss-audit.mjs` | Public-readiness audit (secrets, personal data) | `npm run oss:audit` |
| `ops/e2e-daily-loop.mjs` | E2E daily-loop pipeline check (CI cron) | `npm run e2e:loop` |

## aw/ — ActivityWatch bridge

| Script | Purpose | How to run |
|---|---|---|
| `aw/aw-bridge.cjs` | Sync ActivityWatch buckets → Supabase (local port 5601) | `node scripts/aw/aw-bridge.cjs` |
| `aw/aw-daily-sync.cjs` | Daily AW sync (`--days=N` for backfill) | `node scripts/aw/aw-daily-sync.cjs` |
| `aw/aw-desktop-import.cjs` | Import desktop AW bucket export | `node scripts/aw/aw-desktop-import.cjs <file>` |
| `aw/aw-phone-import.cjs` | Import phone AW bucket export | `node scripts/aw/aw-phone-import.cjs <file>` |

## analysis/ — eval + data analysis

| Script | Purpose | How to run |
|---|---|---|
| `analysis/run_eval.mjs` | Batch runner for `vanguard-eval-runner` edge function | `node scripts/analysis/run_eval.mjs` |
| `analysis/backfill_triads.mjs` | Retroactive `vanguard-architect` backfill over stream | `node scripts/analysis/backfill_triads.mjs` |
| `analysis/audit-registry.mjs` | Function registry vs filesystem parity check | `npm run audit:registry` |
| `analysis/analyze-weak-plans.mjs` | Analyse weak planning sessions | `node scripts/analysis/analyze-weak-plans.mjs` |
| `analysis/closure_proposals_review.sql` | Review pending stream closure proposals | Supabase SQL editor |

Env vars: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or anon key where sufficient). Scripts fail fast with a clear error if required env vars are missing.
