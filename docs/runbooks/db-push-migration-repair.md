# Runbook: `supabase db push` — migration history mismatch

## Symptom

```
Remote migration versions not found in local migrations directory.
supabase migration repair --status reverted <many timestamps>
```

Remote DB has migrations applied that are **not** in this git repo (older local experiments or dashboard-only migrations).

## Safe fix for ONE new migration (e.g. unschedule reset-prompt)

**SQL Editor** in Dashboard — paste and run:

`supabase/migrations/20260526100000_unschedule_reset_prompt.sql`

No `db push` required.

## Full repair (when you want `db push` working again)

1. Backup project (Dashboard → Database → backups).

2. Run repair as CLI suggests (marks remote-only versions as reverted in **local** history tracking):

```powershell
cd path/to/Vanguard
supabase migration repair --status reverted 20260514121539 20260514122346 ...
```

Use the **exact list** from your `db push` error output.

3. Retry:

```powershell
supabase db push
```

4. If still failing, prefer `supabase db pull` only after understanding it may generate a large diff — discuss before running on production.

## Do not

- Run `db reset` on production.
- Delete rows from `supabase_migrations.schema_migrations` manually unless you know the full history.

## Reference

Registry of **local** migrations: `supabase/migrations/` (ignore `README.md` in that folder).
