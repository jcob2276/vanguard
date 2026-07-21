drop policy if exists "Users can manage their own location history" on public.location_history;

create policy "Users can manage their own location history"
  on public.location_history
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
