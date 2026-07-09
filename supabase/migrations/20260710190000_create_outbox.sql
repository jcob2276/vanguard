-- Tabela kolejki outbound (outbox pattern)
CREATE TABLE IF NOT EXISTS public.outbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    chat_id BIGINT NOT NULL,
    payload JSONB NOT NULL, -- { method: 'sendMessage'|'editMessageText'|etc, body: { ... } }
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    priority INTEGER NOT NULL DEFAULT 0,
    dedupe_key TEXT UNIQUE,
    send_after TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error_log TEXT,
    attempts INTEGER NOT NULL DEFAULT 0
);

-- Uprawnienia
ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role access" ON public.outbound_messages TO service_role USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.outbound_messages TO service_role;

-- Funkcja triggera HTTP do vanguard-outbox-sender
CREATE OR REPLACE FUNCTION public.trigger_outbound_message_worker() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-outbox-sender',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$;

-- Powiązanie triggera
CREATE OR REPLACE TRIGGER tr_vanguard_outbox_queue 
  AFTER INSERT ON public.outbound_messages 
  FOR EACH ROW 
  EXECUTE FUNCTION public.trigger_outbound_message_worker();
