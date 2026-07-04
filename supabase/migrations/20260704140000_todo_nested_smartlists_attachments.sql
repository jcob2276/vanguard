-- Todo upgrades: real nested subtasks, Smart Lists (saved searches), file attachments.

-- 1. Nested subtasks — any todo_item can be a child of another, full feature parity
-- (priority/due_date/reminders/tags all just work, unlike the flat markdown checklist).
alter table public.todo_items add column if not exists parent_task_id uuid references public.todo_items(id) on delete cascade;
create index if not exists idx_todo_items_parent_task_id on public.todo_items(parent_task_id);

-- 2. Smart Lists — saved query strings, shown as extra tabs alongside sections.
create table if not exists public.todo_smart_lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text default '🔍',
  query text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_todo_smart_lists_user_id on public.todo_smart_lists(user_id);

alter table public.todo_smart_lists enable row level security;
drop policy if exists "Users manage their own smart lists" on public.todo_smart_lists;
create policy "Users manage their own smart lists"
  on public.todo_smart_lists
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant all on public.todo_smart_lists to authenticated;

-- 3. File attachments.
create table if not exists public.todo_attachments (
  id uuid default gen_random_uuid() primary key,
  todo_item_id uuid references public.todo_items(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_name text not null,
  file_url text not null,
  file_size int,
  mime_type text,
  created_at timestamptz default now()
);
create index if not exists idx_todo_attachments_todo_item_id on public.todo_attachments(todo_item_id);
create index if not exists idx_todo_attachments_user_id on public.todo_attachments(user_id);

alter table public.todo_attachments enable row level security;
drop policy if exists "Users manage their own todo attachments" on public.todo_attachments;
create policy "Users manage their own todo attachments"
  on public.todo_attachments
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant all on public.todo_attachments to authenticated;

-- Storage bucket for attachment files (public, matching progress-photos convention).
insert into storage.buckets (id, name, public)
values ('todo-attachments', 'todo-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Users upload their own todo attachments" on storage.objects;
create policy "Users upload their own todo attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'todo-attachments' and owner = auth.uid());

drop policy if exists "Users view their own todo attachments" on storage.objects;
create policy "Users view their own todo attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'todo-attachments' and owner = auth.uid());

drop policy if exists "Users delete their own todo attachments" on storage.objects;
create policy "Users delete their own todo attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'todo-attachments' and owner = auth.uid());
