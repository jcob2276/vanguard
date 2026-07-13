# Deployed Edge Functions Ledger

This ledger tracks all manual deployments of Supabase Edge Functions. Always record your deployment here **before** deploying to production.

Historical deploys before this ledger existed are not backfilled — verify actual
live state with `list_edge_functions` (Supabase MCP) or `supabase functions list`
rather than trusting entries you didn't write yourself.

| Function Name | Git SHA | Deployed At | Deployed By | Notes / Reason |
|---|---|---|---|---|
| vanguard-auto-classify | 0b2bf176 | 2026-07-13 | Antigravity | Fix check constraint violation by mapping recovery_event to positive_micro_action and clamping other invalid event_kind values to null. |
