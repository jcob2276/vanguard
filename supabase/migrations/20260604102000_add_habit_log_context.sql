alter table public.habit_logs
  add column if not exists final_stimulus text,
  add column if not exists context_note text,
  add column if not exists logged_at timestamptz default now();

create index if not exists idx_habit_logs_user_habit_date
  on public.habit_logs (user_id, habit_id, date desc);
