export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
}

/** Popular coins — CoinGecko ids (free API, no wallet access). */
export const COINGECKO_COINS: CoinGeckoCoin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin' },
];

export function findCoinById(id: string): CoinGeckoCoin | undefined {
  return COINGECKO_COINS.find((c) => c.id === id);
}

export function computeCryptoValuePln(amount: number, pricePln: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(pricePln)) return 0;
  return Math.max(0, amount * pricePln);
}

export function isCryptoLinkedAccount(account: {
  coingecko_id?: string | null;
  crypto_amount?: number | null;
}): boolean {
  return Boolean(account.coingecko_id && account.crypto_amount != null && account.crypto_amount > 0);
}
