# Graph Temporal Status — Dev Invariant

## The core distinction

```
status = 'active'       → row is not deprecated (technical flag)
temporal_status = 'current' → row represents current evidence (semantic flag)
```

These are orthogonal. A row can be `status=active` AND `temporal_status=unknown`.
**This is the majority of the graph: 823 legacy edges with status=active, temporal_status=unknown.**

## Rule

> Graph is evidence memory, not current truth.

Current retrieval (Oracle, Briefing, Analyst) must filter:

```sql
AND temporal_status IN ('current', 'declared')
```

Archive/historical retrieval (explicit only) may use:

```sql
AND temporal_status IN ('current', 'declared', 'hypothesis', 'unknown', 'stale', 'historical')
-- or pass p_include_historical = true to RPCs
```

## Breakdown (as of 2026-05-16)

| temporal_status | count | use in current retrieval? |
|---|---|---|
| unknown | 823 | ❌ NO — legacy, no provenance |
| current | 67 | ✅ YES |
| hypothesis | 39 | ❌ NO — unverified |
| declared | 0 | ✅ YES — user-declared intent |
| historical | 0 | ❌ NO — superseded |
| stale | 0 | ❌ NO — expired |

## RPC contracts

- `search_entity_links` — returns only `temporal_status IN ('current', 'declared')`
- `get_vanguard_graph_context` — by default (`p_include_historical=false`) returns only `temporal_status IN ('current', 'declared')`

Do not change these without understanding the temporal collapse risk.

## Sanity check

After any schema migration touching `vanguard_entity_links`, run:

```sql
SELECT * FROM v_graph_temporal_guard;
```

Expected: no `unknown/stale/historical` rows appear in the `✅ CURRENT` bucket.

## Temporal collapse definition

Temporal collapse = treating historical, declared, or hypothetical edges as current truth.

Symptom: briefing says "Jakub ma X" based on a 6-month-old graph edge with `temporal_status=unknown`.

Prevention: always filter by `temporal_status`, never by `status` alone.
