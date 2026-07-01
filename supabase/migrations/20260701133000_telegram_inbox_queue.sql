-- Migration: 20260701133000_telegram_inbox_queue.sql
-- Create table vanguard_telegram_inbox, setup RLS, and trigger public.trigger_vanguard_telegram_worker()

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.vanguard_telegram_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vanguard_telegram_inbox ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and recreate
DROP POLICY IF EXISTS "Allow service role access" ON public.vanguard_telegram_inbox;
CREATE POLICY "Allow service role access" 
  ON public.vanguard_telegram_inbox
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to invoke the worker Edge Function asynchronously
CREATE OR REPLACE FUNCTION public.trigger_vanguard_telegram_worker()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://pdvqkgfsqziqlhptatgf.supabase.co/functions/v1/vanguard-telegram-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS tr_vanguard_telegram_queue ON public.vanguard_telegram_inbox;
CREATE TRIGGER tr_vanguard_telegram_queue
AFTER INSERT ON public.vanguard_telegram_inbox
FOR EACH ROW
EXECUTE FUNCTION public.trigger_vanguard_telegram_worker();
