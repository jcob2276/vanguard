# Runbook: post-deploy smoke (Etap 5)

## When to run

After **any** deploy of cron, webhook, or `vanguard-telegram` functions.

Goal: catch **401 Unauthorized** from `verify_jwt: true` on functions that pg_cron or Telegram call without a user JWT.

---

## 1. Quick smoke (safe, ~30s)

From repo root, with env loaded (`.env` or `.env.local`):

```powershell
cd path/to/Vanguard
node scripts/smoke-vanguard.mjs --with-service-role
```

- Uses **OPTIONS** only — no Telegram messages, no LLM spend.
- **FAIL** on HTTP **401** → redeploy with `--no-verify-jwt`.

---

## 2. After changing function logic (optional)

```powershell
node scripts/smoke-vanguard.mjs --with-service-role --invoke-safe
```

POSTs minimal bodies (`vanguard-reset-prompt` → 410, `auto-classify` → empty, `architect` → `limit: 0`).

Do **not** use `--invoke-crons` unless you accept possible Telegram / LLM side effects.

---

## 3. Cron parity (SQL)

In Supabase **SQL Editor**, run:

`scripts/ops/cron-check.sql`

Compare with SSOT:

`scripts/ops/smoke-manifest.mjs` → `CRON_FROM_MIGRATIONS`, `CRON_DASHBOARD_ONLY`, `CRON_REMOVED`

| Source | Meaning |
|--------|---------|
| Migrations | Should exist if migrations applied |
| Dashboard only | May be missing in SQL until you create job in UI |
| CRON_REMOVED | Must return **zero rows** |

---

## 4. Bulk redeploy (no JWT)

```powershell
.\scripts\ops\deploy-no-jwt.ps1
# or single function:
.\scripts\ops\deploy-no-jwt.ps1 vanguard-telegram
```

Then repeat step 1.

---

## 5. Manual checks (still valuable)

| Check | Where |
|-------|--------|
| Edge logs, no 401 | Dashboard → Edge Functions → Logs |
| Telegram stream | Send one line to bot |
| Evening loop | Only at real cron time, or `?force=true` on reconciliation URL (manual) |

---

## Env vars

| Variable | Smoke |
|----------|--------|
| `SUPABASE_URL` | Required (or default project URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | For `--with-service-role` |
| `VANGUARD_CRON_SECRET` | Only for `save-daily-aggregate` POST tests |
| `VANGUARD_USER_ID` | Oracle safe POST if using `--invoke-safe` |

---

## Related

- Migration history repair: `docs/runbooks/db-push-migration-repair.md`
- Function registry: `supabase/functions/README.md`
