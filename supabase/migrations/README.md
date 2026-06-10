# Migrations index

Migrations are chronological in `supabase/migrations/`. Do not reorder or rename applied migrations.

New migrations should use domain prefix in the name:

```
YYYYMMDD_vanguard_*
YYYYMMDD_integration_*
YYYYMMDD_graph_*
```

## Domain map (applied)

### Core / stream / intentions
- `20260513000000_intentions`
- `20260513000003_stream_auto_classify`
- `20260513000002_feedback_loop`
- `20260513000005_auto_classify_trigger`

### Graph / knowledge / temporal KG
- `20260512000000_graph_foundation`
- `20260514144339_graph_ontology`
- `20260514150401_graph_embeddings`
- `20260514154206_temporal_kg_part1_schema` (+ parts 2–4)
- `20260516101432_sprint0_temporal_status_on_entity_links`

### Eval harness
- `20260514130309_raw_events_and_eval_harness`
- `20260514161753_eval_results_add_category`
- `20260514170023_eval_run_status_completed`

### Friction / reconciliation / planning
- `20260516101419_sprint0_friction_events_table`
- `20260518084315_sprint_08_daily_reconciliation`
- `20260521212030_daily_planning_session`
- `20260521212813_planning_summary_column`


### Cron fixes
- `20260519142633_fix_cron_current_setting_null_bug`
- `20260519142723_fix_cron_analyst_and_briefing_current_setting`

## Known constraint gotchas

If code inserts fail silently or with 500, check CHECK constraints:

```sql
-- planning_status: pending | active | completed (not 'done')
```

See `docs/runbooks/db-constraint-mismatch.md`
