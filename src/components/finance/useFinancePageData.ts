import { useMemo } from 'react';
import { useFinanceBundle } from '../../lib/financeApi';
import { useCoinPrices } from '../../lib/coingeckoApi';
import { applyCoinPrices, extractCoinIds } from '../../lib/finance/accountValues';
import { useFinanceMetrics } from './useFinanceMetrics';

export function useFinancePageData(userId: string | undefined) {
  const bundleQuery = useFinanceBundle(userId);
  const coinIds = useMemo(
    () => extractCoinIds(bundleQuery.data?.accounts ?? []),
    [bundleQuery.data?.accounts],
  );
  const coinPricesQuery = useCoinPrices(coinIds);

  const enrichedData = useMemo(() => {
    if (!bundleQuery.data) return undefined;
    return {
      ...bundleQuery.data,
      accounts: applyCoinPrices(bundleQuery.data.accounts, coinPricesQuery.data),
    };
  }, [bundleQuery.data, coinPricesQuery.data]);

  const metrics = useFinanceMetrics(enrichedData);

  return {
    bundleQuery,
    coinPricesQuery,
    data: enrichedData,
    metrics,
  };
}
