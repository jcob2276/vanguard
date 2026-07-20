-- Add dedup_hash column to finance_transactions for CSV import deduplication.
-- Nullable so existing rows are unaffected; new rows from CSV import will populate it.
alter table finance_transactions
  add column if not exists dedup_hash text;

-- Partial unique index: only one row per (user_id, dedup_hash) when hash is set.
create unique index if not exists finance_transactions_dedup_hash_idx
  on finance_transactions (user_id, dedup_hash)
  where dedup_hash is not null;
