-- Migration: 20260722_finance_snowball.sql
-- Tables for Snowball Analytics engine (Dividends, Holding Targets / Rebalancing)

CREATE TABLE IF NOT EXISTS public.finance_dividends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    company_name TEXT NOT NULL,
    amount_per_share NUMERIC(12, 4) NOT NULL DEFAULT 0,
    shares_count NUMERIC(12, 4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) GENERATED ALWAYS AS (amount_per_share * shares_count) STORED,
    currency TEXT NOT NULL DEFAULT 'PLN',
    ex_date DATE NOT NULL,
    pay_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('expected', 'received')) DEFAULT 'expected',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_holding_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    asset_category TEXT NOT NULL CHECK (asset_category IN ('stocks', 'etf', 'crypto', 'bonds', 'cash')) DEFAULT 'stocks',
    target_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, ticker)
);

-- RLS Policies
ALTER TABLE public.finance_dividends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_holding_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own finance_dividends"
    ON public.finance_dividends FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own finance_holding_targets"
    ON public.finance_holding_targets FOR ALL
    USING (auth.uid() = user_id);
