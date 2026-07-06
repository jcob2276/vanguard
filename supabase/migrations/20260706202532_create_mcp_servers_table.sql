CREATE TABLE IF NOT EXISTS public.mcp_servers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    api_key text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'error', 'inactive')),
    last_error text,
    last_ping_at timestamp with time zone
);

ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mcp_servers" 
    ON public.mcp_servers 
    FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id ON public.mcp_servers(user_id);
