alter table public.note_attachments
  add column if not exists transcript text;

alter table public.vanguard_notes
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_payload text,
  add column if not exists lock_salt text,
  add column if not exists lock_iv text;

alter table public.vanguard_notes
  add constraint vanguard_notes_lock_payload_check
  check (
    (is_locked = false)
    or (
      locked_payload is not null
      and lock_salt is not null
      and lock_iv is not null
      and content = ''
      and cardinality(tags) = 0
    )
  ) not valid;

alter table public.vanguard_notes
  validate constraint vanguard_notes_lock_payload_check;
