import { useQuery } from '@tanstack/react-query';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

interface CoinPriceQuote {
  pln: number;
  usd: number;
  change24hPct: number;
}

export type CoinPriceMap = Record<string, CoinPriceQuote>;

interface CoinGeckoPriceRow {
  pln?: number;
  usd?: number;
  pln_24h_change?: number;
  usd_24h_change?: number;
}

async function fetchCoinPricesPln(coinIds: string[]): Promise<CoinPriceMap> {
  const ids = [...new Set(coinIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const params = new URLSearchParams({
    ids: ids.join(','),
    vs_currencies: 'pln,usd',
    include_24hr_change: 'true',
  });

  const res = await fetch(`${COINGECKO_BASE}/simple/price?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`CoinGecko: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as Record<string, CoinGeckoPriceRow>;
  const out: CoinPriceMap = {};

  for (const id of ids) {
    const row = raw[id];
    if (!row) continue;
    out[id] = {
      pln: row.pln ?? 0,
      usd: row.usd ?? 0,
      change24hPct: row.pln_24h_change ?? row.usd_24h_change ?? 0,
    };
  }

  return out;
}

export function useCoinPrices(coinIds: string[]) {
  const key = [...new Set(coinIds.filter(Boolean))].sort().join(',');

  return useQuery({
    queryKey: ['coingecko', 'prices', key],
    queryFn: () => fetchCoinPricesPln(key.split(',').filter(Boolean)),
    enabled: key.length > 0,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });
}
