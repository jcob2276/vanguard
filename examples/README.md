# Vanguard — Examples for AI Context

These are canonical patterns extracted from the actual codebase.
When generating a PRP, reference these files so the AI mirrors existing conventions exactly.

| File | When to use |
|---|---|
| `edge-function.ts` | Any new Supabase Edge Function (Deno TypeScript) |
| `frontend-component.jsx` | Any new React component that reads data or calls edge functions |
| `frontend-fetch.jsx` | The canonical `call()` helper pattern for edge function invocations |
| `migration.sql` | Any new table or schema change |
| `rpc.sql` | Any new Postgres RPC function |
