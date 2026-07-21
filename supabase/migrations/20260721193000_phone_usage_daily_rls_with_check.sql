-- phone_usage_daily: explicit WITH CHECK so authenticated upsert from mobile client works.
drop policy if exists "Users can manage own phone usage" on public.phone_usage_daily;

create policy "Users can manage own phone usage"
  on public.phone_usage_daily
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
