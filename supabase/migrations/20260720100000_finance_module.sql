-- Personal finance decision layer (single-user Vanguard module).

CREATE TABLE IF NOT EXISTS public.finance_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_expenses numeric NOT NULL DEFAULT 0,
  monthly_income numeric NOT NULL DEFAULT 0,
  expected_return_pct numeric NOT NULL DEFAULT 7,
  inflation_pct numeric NOT NULL DEFAULT 3,
  safe_withdrawal_rate_pct numeric NOT NULL DEFAULT 4,
  emergency_target_months numeric NOT NULL DEFAULT 6,
  years_to_retirement numeric NOT NULL DEFAULT 20,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  account_type text NOT NULL DEFAULT 'bank'
    CHECK (account_type IN ('cash', 'bank', 'etf', 'stocks', 'btc', 'bonds', 'other')),
  is_liquid boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 0,
  deadline date,
  auto_save_monthly numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  value_score smallint NOT NULL DEFAULT 5
    CHECK (value_score BETWEEN 1 AND 10),
  is_impulse boolean NOT NULL DEFAULT false,
  cool_off_until date,
  still_want boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_monthly numeric NOT NULL DEFAULT 0,
  renewal_date date,
  is_active boolean NOT NULL DEFAULT true,
  is_unused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_day smallint NOT NULL DEFAULT 1
    CHECK (due_day BETWEEN 1 AND 31),
  reminder_days smallint NOT NULL DEFAULT 3
    CHECK (reminder_days BETWEEN 0 AND 30),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT 'Inne',
  note text,
  transaction_date date NOT NULL DEFAULT (CURRENT_DATE),
  kind text NOT NULL DEFAULT 'expense'
    CHECK (kind IN ('expense', 'income')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount_monthly numeric NOT NULL DEFAULT 0,
  source_type text NOT NULL DEFAULT 'other'
    CHECK (source_type IN ('salary', 'sales', 'commission', 'interest', 'dividend', 'refund', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_month date NOT NULL,
  net_worth numeric NOT NULL DEFAULT 0,
  liquid_cash numeric NOT NULL DEFAULT 0,
  investments numeric NOT NULL DEFAULT 0,
  debts numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS finance_accounts_user_idx ON public.finance_accounts (user_id);
CREATE INDEX IF NOT EXISTS finance_transactions_user_date_idx ON public.finance_transactions (user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS finance_goals_user_idx ON public.finance_goals (user_id);

ALTER TABLE public.finance_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_profile_own ON public.finance_profile
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_accounts_own ON public.finance_accounts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_goals_own ON public.finance_goals
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_wishlist_own ON public.finance_wishlist
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_subscriptions_own ON public.finance_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_bills_own ON public.finance_bills
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_transactions_own ON public.finance_transactions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_income_sources_own ON public.finance_income_sources
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY finance_snapshots_own ON public.finance_snapshots
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
