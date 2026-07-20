import { describe, expect, it } from 'vitest';
import { computeCryptoValuePln, isCryptoLinkedAccount } from '@vanguard/domain';
import { applyCoinPrices, extractCoinIds } from './accountValues';
import type { FinanceAccount } from '../financeApi';

describe('finance crypto values', () => {
  it('computes PLN value from amount and price', () => {
    expect(computeCryptoValuePln(0.5, 400_000)).toBe(200_000);
  });

  it('detects crypto-linked accounts', () => {
    expect(isCryptoLinkedAccount({ coingecko_id: 'bitcoin', crypto_amount: 1 })).toBe(true);
    expect(isCryptoLinkedAccount({ coingecko_id: 'bitcoin', crypto_amount: 0 })).toBe(false);
  });

  it('extracts coin ids and applies live prices to balances', () => {
    const accounts: FinanceAccount[] = [
      {
        id: '1',
        user_id: 'u',
        name: 'BTC',
        balance: 0,
        account_type: 'btc',
        is_liquid: false,
        sort_order: 0,
        coingecko_id: 'bitcoin',
        crypto_amount: 0.1,
        created_at: '',
      },
      {
        id: '2',
        user_id: 'u',
        name: 'Bank',
        balance: 5000,
        account_type: 'bank',
        is_liquid: true,
        sort_order: 1,
        coingecko_id: null,
        crypto_amount: null,
        created_at: '',
      },
    ];

    expect(extractCoinIds(accounts)).toEqual(['bitcoin']);
    const enriched = applyCoinPrices(accounts, {
      bitcoin: { pln: 300_000, usd: 70_000, change24hPct: -1.2 },
    });
    expect(enriched[0].balance).toBe(30_000);
    expect(enriched[1].balance).toBe(5000);
  });
});
