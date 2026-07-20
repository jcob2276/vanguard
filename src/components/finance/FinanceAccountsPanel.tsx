import { useState } from 'react';
import {
  FINANCE_ACCOUNT_LABELS,
  findCoinById,
  type FinanceAccountType,
} from '@vanguard/domain';
import Button from '../ui/Button';
import { ToggleChip } from '../ui/ToggleChip';
import { ControlInput } from '../ui/ControlPrimitives';
import { formatPln } from '../../lib/finance/formatMoney';
import type { CoinPriceMap } from '../../lib/coingeckoApi';
import type { FinanceAccount } from '../../lib/financeApi';
import { QuickAddForm } from './financeShared';
import { BrokerManualHint, FinanceCryptoAccountForm } from './FinanceCryptoAccountForm';
import { FinanceEmpty, FinanceList, FinanceRow, FinanceSection } from './financeUi';

type AddFinanceAccountInput = {
  name: string;
  balance: number;
  account_type: FinanceAccountType;
  coingecko_id?: string | null;
  crypto_amount?: number | null;
};

interface FinanceAccountsPanelProps {
  accounts: FinanceAccount[];
  coinPrices?: CoinPriceMap;
  pricesLoading?: boolean;
  onAdd: (input: AddFinanceAccountInput) => void;
  onUpdate: (input: { id: string; balance?: number; crypto_amount?: number }) => void;
  onRemove: (id: string) => void;
}

function formatChangePct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function AccountRow({
  account,
  coinPrices,
  onUpdate,
  onRemove,
}: {
  account: FinanceAccount;
  coinPrices?: CoinPriceMap;
  onUpdate: (input: { id: string; balance?: number; crypto_amount?: number }) => void;
  onRemove: (id: string) => void;
}) {
  const [editValue, setEditValue] = useState(
    String(account.coingecko_id ? account.crypto_amount ?? 0 : account.balance),
  );
  const coin = account.coingecko_id ? findCoinById(account.coingecko_id) : undefined;
  const quote = account.coingecko_id ? coinPrices?.[account.coingecko_id] : undefined;
  const isCrypto = Boolean(account.coingecko_id);

  const meta = [
    FINANCE_ACCOUNT_LABELS[account.account_type as FinanceAccountType],
    account.is_liquid ? 'płynne' : null,
    isCrypto && coin ? `${account.crypto_amount ?? 0} ${coin.symbol}` : null,
    isCrypto && quote ? `${formatChangePct(quote.change24hPct)} 24h` : null,
  ].filter(Boolean).join(' · ');

  return (
    <FinanceRow primary={account.name} secondary={meta} trailing={formatPln(account.balance)}>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const num = Number(editValue);
            if (isCrypto) onUpdate({ id: account.id, crypto_amount: num });
            else onUpdate({ id: account.id, balance: num });
          }}
        >
          <ControlInput
            type="number"
            step="any"
            min="0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="min-h-9 w-28 rounded-lg border-0 bg-surface-2/80 px-2 text-sm ring-1 ring-border-custom/25"
            aria-label={isCrypto ? `Ilość ${account.name}` : `Saldo ${account.name}`}
          />
          <Button type="submit" size="sm" variant="secondary" className="rounded-lg active:scale-[0.98]">
            {isCrypto ? 'Zapisz' : 'Saldo'}
          </Button>
        </form>
        <Button variant="ghost" size="sm" onClick={() => onRemove(account.id)} className="text-danger">
          Usuń
        </Button>
      </div>
    </FinanceRow>
  );
}

export function FinanceAccountsPanel({
  accounts,
  coinPrices,
  pricesLoading,
  onAdd,
  onUpdate,
  onRemove,
}: FinanceAccountsPanelProps) {
  const [type, setType] = useState<FinanceAccountType>('bank');

  return (
    <FinanceSection
      title="Konta"
      subtitle={pricesLoading ? 'Odświeżam ceny krypto…' : 'Bank, broker ręcznie, CoinGecko dla BTC/ETH.'}
    >
      <div className="space-y-3 px-4 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FINANCE_ACCOUNT_LABELS) as FinanceAccountType[]).map((t) => (
            <ToggleChip key={t} active={type === t} onClick={() => setType(t)} size="sm">
              {FINANCE_ACCOUNT_LABELS[t]}
            </ToggleChip>
          ))}
        </div>
      </div>

      {type === 'btc' ? (
        <div className="px-4 pb-4">
          <FinanceCryptoAccountForm
            onAdd={(input) => onAdd({
              name: input.name,
              balance: 0,
              account_type: 'btc',
              coingecko_id: input.coingecko_id,
              crypto_amount: input.crypto_amount,
            })}
          />
        </div>
      ) : (
        <>
          <div className="px-4 pb-1">
            <BrokerManualHint accountType={type} />
          </div>
          <QuickAddForm
            fields={[
              { key: 'name', placeholder: 'Nazwa konta' },
              { key: 'balance', placeholder: 'Saldo (PLN)', type: 'number', defaultValue: '0' },
            ]}
            onSubmit={(v) => onAdd({
              name: v.name,
              balance: Number(v.balance),
              account_type: type,
            })}
          />
        </>
      )}

      {accounts.length === 0 ? (
        <FinanceEmpty>Dodaj pierwsze konto — wtedy zobaczysz majątek i alokację.</FinanceEmpty>
      ) : (
        <FinanceList>
          {accounts.map((a) => (
            <AccountRow key={a.id} account={a} coinPrices={coinPrices} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </FinanceList>
      )}
    </FinanceSection>
  );
}
