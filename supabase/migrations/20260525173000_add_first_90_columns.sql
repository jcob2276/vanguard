-- MIGRACJA: Vanguard OS Anti-Drift Daily Loop (first 90 & anti-analysis)
-- Data: 2026-05-25
-- Cel: Dodanie kolumn do daily_reconciliations dla śledzenia porannego bloku i guardów analizy

ALTER TABLE public.daily_reconciliations 
  ADD COLUMN IF NOT EXISTS first_90_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_90_protected boolean,
  ADD COLUMN IF NOT EXISTS analysis_without_deployment boolean DEFAULT false;
