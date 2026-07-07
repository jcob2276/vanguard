-- Create vanguard_llm_usage table to track model usage and costs
CREATE TABLE IF NOT EXISTS public.vanguard_llm_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    model text NOT NULL,
    prompt_tokens integer NOT NULL,
    completion_tokens integer NOT NULL,
    total_tokens integer NOT NULL,
    cost_est numeric(10, 6) DEFAULT 0.0,
    feature text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.vanguard_llm_usage ENABLE ROW LEVEL SECURITY;

-- Create policy: authenticated users can read their own logs
CREATE POLICY select_own_llm_usage ON public.vanguard_llm_usage
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Create policy: service_role has full access
CREATE POLICY service_role_all ON public.vanguard_llm_usage
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE public.vanguard_llm_usage TO service_role;
GRANT SELECT ON TABLE public.vanguard_llm_usage TO authenticated;
