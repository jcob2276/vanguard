# Deploy edge function

## Before deploy

1. Read `supabase/functions/README.md` — confirm JWT setting for target function
2. Read `.cursor/rules/vanguard-ops.mdc` — cron/webhook = `verify_jwt: false`

## Deploy via Supabase MCP

```
deploy_edge_function(
  project_id: YOUR_PROJECT_REF,
  name: <function-slug>,
  verify_jwt: false,   # for cron/webhook functions
  files: [{ name: "index.ts", content: "..." }]
)
```

## Deploy via CLI

```bash
supabase functions deploy vanguard-telegram --no-verify-jwt
supabase functions deploy vanguard-morning-brief --no-verify-jwt
```

## After deploy

1. Supabase Dashboard → Edge Functions → Logs
2. Look for **401 Unauthorized** in first 5 minutes
3. For Telegram: send test message to bot
4. For cron: wait for next scheduled run or trigger manually

## Common failure: 401 after deploy

**Cause:** Function deployed with `verify_jwt: true` but called by cron/Telegram without user JWT.

**Fix:** Redeploy with `--no-verify-jwt` / `verify_jwt: false`.

Affected functions: see list in `vanguard-ops.mdc`.

## Common failure: function works locally but 500 in production

**Cause:** Missing secret in Supabase dashboard.

**Fix:** Settings → Edge Functions → Secrets. Verify all env vars from `AGENTS.md`.
