-- Migration: Consolidate project_checkpoints into public.todo_items
-- Add is_milestone and project_id to public.todo_items table.
-- Active checkpoints are copied, completed ones stay in project_checkpoints as history.

alter table public.todo_items add column if not exists is_milestone boolean not null default false;
alter table public.todo_items add column if not exists project_id uuid references public.projects(id) on delete cascade;

-- Performance indexing
create index if not exists todo_items_project_id_idx on public.todo_items(project_id);
create index if not exists todo_items_is_milestone_idx on public.todo_items(is_milestone);

-- Data migration: migrate open/pending checkpoints
insert into public.todo_items (
  title,
  due_date,
  status,
  project_id,
  user_id,
  is_milestone,
  priority,
  sort_order,
  created_at,
  updated_at
)
select
  title,
  due_date,
  'open' as status,
  project_id,
  user_id,
  true as is_milestone,
  'high' as priority,
  coalesce(sort_order, 0) as sort_order,
  created_at,
  updated_at
from public.project_checkpoints
where status in ('pending', 'open')
on conflict do nothing;
