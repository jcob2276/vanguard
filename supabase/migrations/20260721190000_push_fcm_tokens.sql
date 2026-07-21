-- FCM device tokens for Capacitor Android (alongside Web Push in push_subscriptions).
create table if not exists public.push_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null default 'android'
    check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

comment on table public.push_fcm_tokens is
  'Capacitor/FCM device tokens. Web Push stays in push_subscriptions; dual-send in vanguard-push-reminder.';

create index if not exists idx_push_fcm_tokens_user_id
  on public.push_fcm_tokens (user_id);

alter table public.push_fcm_tokens enable row level security;

create policy "owner" on public.push_fcm_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on table public.push_fcm_tokens to authenticated;
grant all on table public.push_fcm_tokens to service_role;
