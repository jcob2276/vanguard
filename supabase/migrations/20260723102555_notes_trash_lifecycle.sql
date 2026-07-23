alter table public.vanguard_notes
  add column if not exists deleted_at timestamptz;

create index if not exists idx_vanguard_notes_user_deleted_updated
  on public.vanguard_notes (user_id, deleted_at, updated_at desc);

comment on column public.vanguard_notes.deleted_at is
  'Soft-delete timestamp. NULL means the note is active; non-NULL means it is in Trash.';
