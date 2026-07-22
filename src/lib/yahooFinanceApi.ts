import { useQuery } from '@tanstack/react-query';
import { formatWarsawDate } from './date';

const YAHOO_FINANCE_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

export interface YahooQuoteData {
  ticker: string;
  regularMarketPrice: number;
  chartPreviousClose: number;
  change24hPct: number;
  currency: string;
  dividends: {
    exDate: string;
    amount: number;
  }[];
}

export type YahooQuoteMap = Record<string, YahooQuoteData>;

async function fetchYahooQuote(ticker: string): Promise<YahooQuoteData | null> {
  if (!ticker) return null;
  try {
    const res = await fetch(`${YAHOO_FINANCE_BASE}/${encodeURIComponent(ticker)}?interval=1d&events=div`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? price;
    const change24hPct = prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;
    const currency = meta.currency ?? 'USD';

    const eventsDiv = result.events?.dividends;
    const dividends: { exDate: string; amount: number }[] = [];

    if (eventsDiv && typeof eventsDiv === 'object') {
      Object.values(eventsDiv as Record<string, { amount?: number; date?: number }>).forEach((divItem) => {
        const amt = typeof divItem?.amount === 'number' ? divItem.amount : 0;
        const date = typeof divItem?.date === 'number' ? divItem.date : 0;
        if (amt && date) {
          const dateStr = formatWarsawDate(new Date(date * 1000));
          dividends.push({ exDate: dateStr, amount: amt });
        }
      });
    }

    return {
      ticker,
      regularMarketPrice: price,
      chartPreviousClose: prevClose,
      change24hPct,
      currency,
      dividends,
    };
  } catch (err) {
    console.warn(`[YahooFinanceAPI] Failed to fetch quote for ${ticker}:`, err);
    return null;
  }
}

export function useYahooQuotes(tickers: string[]) {
  const key = [...new Set(tickers.filter(Boolean))].sort().join(',');

  return useQuery({
    queryKey: ['yahooFinance', 'quotes', key],
    queryFn: async () => {
      const list = key.split(',').filter(Boolean);
      const out: YahooQuoteMap = {};

      await Promise.all(
        list.map(async (t) => {
          const data = await fetchYahooQuote(t);
          if (data) out[t] = data;
        })
      );

      return out;
    },
    enabled: key.length > 0,
    staleTime: 15 * 60_000, // 15 mins cache
    refetchInterval: 30 * 60_000, // auto refetch every 30 mins
    retry: 1,
  });
}
