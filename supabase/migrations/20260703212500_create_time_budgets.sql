-- Migration: create vanguard_time_budgets table
create table if not exists public.vanguard_time_budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  category varchar(50) not null, -- 'work', 'health', 'personal', 'sport', 'study'
  min_hours decimal(4,1) default null,
  max_hours decimal(4,1) default null,
  created_at timestamptz default now(),
  unique(user_id, category)
);

create index if not exists idx_vanguard_time_budgets_user_id on public.vanguard_time_budgets(user_id);

-- Enable Row Level Security
alter table public.vanguard_time_budgets enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can manage their own time budgets" on public.vanguard_time_budgets;

-- Create policy
create policy "Users can manage their own time budgets"
  on public.vanguard_time_budgets
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Grant access
grant all on public.vanguard_time_budgets to authenticated;
