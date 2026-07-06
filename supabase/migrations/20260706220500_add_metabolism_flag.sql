-- Migration to add 'condensed' flag for Metabolism (Hipoteza 3)
ALTER TABLE public.vanguard_daily_aggregates
ADD COLUMN IF NOT EXISTS condensed boolean DEFAULT false;

-- Migration to add 'vanguard_recipes' table for Telegram Poke Architecture (Hipoteza 4)
CREATE TABLE IF NOT EXISTS public.vanguard_recipes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    trigger_type text NOT NULL, -- e.g., 'cron', 'webhook', 'event'
    trigger_condition text,     -- e.g., 'strain_score > 15', 'time == 08:00'
    action_type text NOT NULL,  -- e.g., 'notify_telegram', 'call_oracle'
    action_payload jsonb,       -- e.g., {"message": "You are tired, take a rest."}
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS and add basic policy for vanguard_recipes
ALTER TABLE public.vanguard_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recipes"
    ON public.vanguard_recipes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
