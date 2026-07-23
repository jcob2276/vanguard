alter table public.note_attachments
  add column if not exists ocr_text text;
