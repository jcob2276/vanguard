-- Create the public.food_parse_pending table to hold temporary parsed meal data before user confirmation.

CREATE TABLE IF NOT EXISTS public.food_parse_pending (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    log_date date NOT NULL,
    meal_type text NOT NULL,
    items jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Primary key constraint
ALTER TABLE ONLY public.food_parse_pending
    ADD CONSTRAINT food_parse_pending_pkey PRIMARY KEY (id);

-- Alter table owner
ALTER TABLE public.food_parse_pending OWNER TO postgres;

-- Enable RLS
ALTER TABLE public.food_parse_pending ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own food_parse_pending" 
    ON public.food_parse_pending 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow full access to service_role on food_parse_pending" 
    ON public.food_parse_pending 
    TO service_role 
    USING (true) 
    WITH CHECK (true);
