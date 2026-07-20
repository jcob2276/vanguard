import { computeCryptoValuePln } from '@vanguard/domain';
import type { CoinPriceMap } from '../coingeckoApi';
import type { FinanceAccount } from '../financeApi';

export function extractCoinIds(accounts: FinanceAccount[]): string[] {
  return accounts
    .map((a) => a.coingecko_id)
    .filter((id): id is string => Boolean(id));
}

export function applyCoinPrices(
  accounts: FinanceAccount[],
  prices: CoinPriceMap | undefined,
): FinanceAccount[] {
  if (!prices) return accounts;

  return accounts.map((account) => {
    if (!account.coingecko_id || account.crypto_amount == null) return account;
    const quote = prices[account.coingecko_id];
    if (!quote) return account;

    return {
      ...account,
      balance: computeCryptoValuePln(account.crypto_amount, quote.pln),
    };
  });
}
