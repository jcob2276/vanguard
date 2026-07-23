create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references public.vanguard_notes(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_note_attachments_note_created
  on public.note_attachments (note_id, created_at);

alter table public.note_attachments enable row level security;
grant select, insert, update, delete on public.note_attachments to authenticated;

create policy "Users manage own note attachments"
  on public.note_attachments
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.vanguard_notes n
      where n.id = note_id and n.user_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('note-attachments', 'note-attachments', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy "Users read own note files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users upload own note files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users delete own note files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'note-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
