-- P1 from planning-system integrity audit: daily_wins and daily_reconciliations had no
-- week_start, so weekly rollups joined against weekly_reviews/kpi_entries only by
-- recomputing the Monday-anchor on every read, with zero referential consistency.
-- date_trunc('week', date) is Postgres's ISO week (Monday-anchored), verified to match
-- getWeekStartWarsaw() (date-fns startOfWeek weekStartsOn:1) for every test date checked.
alter table public.daily_wins
  add column week_start date generated always as (date_trunc('week', date::timestamp)::date) stored;

alter table public.daily_reconciliations
  add column week_start date generated always as (date_trunc('week', date::timestamp)::date) stored;

create index if not exists idx_daily_wins_week_start on public.daily_wins(user_id, week_start);
create index if not exists idx_daily_reconciliations_week_start on public.daily_reconciliations(user_id, week_start);
