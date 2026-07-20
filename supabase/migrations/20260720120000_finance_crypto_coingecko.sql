-- CoinGecko-linked crypto holdings (quantity × live price; no wallet/broker sync).

ALTER TABLE public.finance_accounts
  ADD COLUMN IF NOT EXISTS coingecko_id text,
  ADD COLUMN IF NOT EXISTS crypto_amount numeric;

COMMENT ON COLUMN public.finance_accounts.coingecko_id IS 'CoinGecko coin id, e.g. bitcoin. When set, balance is derived from crypto_amount × live price.';
COMMENT ON COLUMN public.finance_accounts.crypto_amount IS 'Token quantity for coingecko_id accounts.';
