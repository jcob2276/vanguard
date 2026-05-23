# DB constraint mismatch

## Symptom

Edge function returns 200 or 500, but no row saved. User sees partial bot response or silence after "Transkrybuję...".

## Diagnosis

Test INSERT manually in Supabase SQL editor:

```sql
-- Example: dojo rep insert test
INSERT INTO dojo_reps (run_id, user_id, day, phase, rep_type, transcript,
  audio_duration_seconds, word_count, evaluation_result, status)
VALUES (
  '<run_id>', '<user_id>', 0, 'rep_a', 'rep_a', 'test',
  60, 100, '{"status":"diagnostic"}'::jsonb, 'diagnostic'
);
```

If error mentions `check constraint`, the code uses a value not in the constraint.

## Known constraints (as of 2026-05)

### dojo_reps.status
```
pass | partial | repeat_day | pending | diagnostic | self_check
```

### dojo_reps.rep_type
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
ALTER TABLE dojo_reps DROP CONSTRAINT dojo_reps_status_check;
ALTER TABLE dojo_reps ADD CONSTRAINT dojo_reps_status_check
  CHECK (status = ANY (ARRAY[
    'pass','partial','repeat_day','pending','diagnostic','self_check'
  ]));

ALTER TABLE dojo_reps DROP CONSTRAINT dojo_reps_rep_type_check;
ALTER TABLE dojo_reps ADD CONSTRAINT dojo_reps_rep_type_check
  CHECK (rep_type = ANY (ARRAY[
    'rep_a','rep_b','correction_rep_a','real_life_transfer'
  ]));
```

Always add a migration file after manual fix:

```
supabase/migrations/YYYYMMDD_dojo_fix_constraints.sql
```

## Prevention

Before adding new status/rep_type values in code, update CHECK constraint first.
