alter table vanguard_links
  add column if not exists thumbnail_url text,
  add column if not exists channel_name text;
