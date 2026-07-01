create table public.endmyopia_prescriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    
    type text not null check (type in ('normalized', 'differential')),
    status text not null check (status in ('active', 'past')),
    
    -- Left Eye (OS)
    sphere_l numeric,
    cyl_l numeric,
    axis_l integer,
    
    -- Right Eye (OD)
    sphere_r numeric,
    cyl_r numeric,
    axis_r integer,
    
    started_at date not null,
    ended_at date,
    notes text,
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.endmyopia_prescriptions enable row level security;

create policy "Users can view own prescriptions"
    on public.endmyopia_prescriptions for select
    using (auth.uid() = user_id);

create policy "Users can insert own prescriptions"
    on public.endmyopia_prescriptions for insert
    with check (auth.uid() = user_id);

create policy "Users can update own prescriptions"
    on public.endmyopia_prescriptions for update
    using (auth.uid() = user_id);

create policy "Users can delete own prescriptions"
    on public.endmyopia_prescriptions for delete
    using (auth.uid() = user_id);
