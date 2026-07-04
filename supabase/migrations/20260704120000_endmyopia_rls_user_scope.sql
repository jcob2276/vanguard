-- Fix: endmyopia_measurements / endmyopia_daily_logs had no user_id column at all,
-- and RLS policies used USING (true) for the `authenticated` role — any authenticated
-- user could read/write every user's eye-health rows. Add user_id, backfill the
-- single existing user, then scope RLS by owner.

alter table public.endmyopia_measurements add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.endmyopia_daily_logs add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.endmyopia_measurements set user_id = (select id from auth.users limit 1) where user_id is null;
update public.endmyopia_daily_logs set user_id = (select id from auth.users limit 1) where user_id is null;

alter table public.endmyopia_measurements alter column user_id set not null;
alter table public.endmyopia_daily_logs alter column user_id set not null;

create index if not exists idx_endmyopia_measurements_user_id on public.endmyopia_measurements(user_id);
create index if not exists idx_endmyopia_daily_logs_user_id on public.endmyopia_daily_logs(user_id);

drop policy if exists "Allow full access to authenticated users on endmyopia_measurements" on public.endmyopia_measurements;
create policy "Users manage their own endmyopia_measurements"
on public.endmyopia_measurements
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Allow full access to authenticated users on endmyopia_daily_logs" on public.endmyopia_daily_logs;
create policy "Users manage their own endmyopia_daily_logs"
on public.endmyopia_daily_logs
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
