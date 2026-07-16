-- Enable Supabase Realtime for vanguard_calendar table idempotently
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'vanguard_calendar'
  ) then
    alter publication supabase_realtime add table public.vanguard_calendar;
  end if;
end;
$$;
