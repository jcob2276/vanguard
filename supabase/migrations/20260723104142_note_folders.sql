create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.note_folders enable row level security;
grant select, insert, update, delete on public.note_folders to authenticated;

create policy "Users manage own note folders"
  on public.note_folders for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.vanguard_notes
  add column if not exists folder_id uuid references public.note_folders(id) on delete set null;

create index if not exists idx_vanguard_notes_user_folder_updated
  on public.vanguard_notes (user_id, folder_id, updated_at desc)
  where deleted_at is null;

create or replace function public.enforce_note_folder_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.note_folders f
    where f.id = new.folder_id and f.user_id = new.user_id
  ) then
    raise exception 'Folder must belong to the note owner';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_note_folder_owner on public.vanguard_notes;
create trigger trg_enforce_note_folder_owner
before insert or update of folder_id, user_id on public.vanguard_notes
for each row execute function public.enforce_note_folder_owner();
