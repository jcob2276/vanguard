# DB constraint mismatch

## Symptom

Edge function returns 200 or 500, but no row saved. User sees partial bot response or silence after "Transkrybuję...".

## Diagnosis

Test INSERT manually in Supabase SQL editor:

```sql
  audio_duration_seconds, word_count, evaluation_result, status)
VALUES (
  '<run_id>', '<user_id>', 0, 'rep_a', 'rep_a', 'test',
  60, 100, '{"status":"diagnostic"}'::jsonb, 'diagnostic'
);
```

If error mentions `check constraint`, the code uses a value not in the constraint.

## Known constraints (as of 2026-05)

```
pass | partial | repeat_day | pending | diagnostic | self_check
```

```
rep_a | rep_b | correction_rep_a | real_life_transfer
```

### daily_reconciliations.planning_status
```
pending | active | completed
```
NOT `done` — use `completed`.

## Fix

```sql
  CHECK (status = ANY (ARRAY[
    'pass','partial','repeat_day','pending','diagnostic','self_check'
  ]));

  CHECK (rep_type = ANY (ARRAY[
    'rep_a','rep_b','correction_rep_a','real_life_transfer'
  ]));
```

Always add a migration file after manual fix:

```
```

## Prevention

Before adding new status/rep_type values in code, update CHECK constraint first.
