create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  scheduled_for date not null,
  status text not null default 'pending' check (status in ('pending', 'sent')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, scheduled_for)
);

alter table public.notification_deliveries enable row level security;

comment on table public.notification_deliveries is
  'Server-owned idempotency and retry ledger for scheduled Web Push deliveries.';

revoke all on table public.notification_deliveries from anon, authenticated;
grant all on table public.notification_deliveries to service_role;

create index notification_deliveries_pending_idx
  on public.notification_deliveries (scheduled_for, status)
  where status = 'pending';
