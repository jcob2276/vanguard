import { COINGECKO_COINS } from '@vanguard/domain';
import Button from '../ui/Button';
import { ControlInput, ControlSelect } from '../ui/ControlPrimitives';

interface FinanceCryptoAccountFormProps {
  onAdd: (input: {
    name: string;
    coingecko_id: string;
    crypto_amount: number;
  }) => void;
}

export function FinanceCryptoAccountForm({ onAdd }: FinanceCryptoAccountFormProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onAdd({
      name: String(fd.get('name') ?? ''),
      coingecko_id: String(fd.get('coin') ?? 'bitcoin'),
      crypto_amount: Number(fd.get('amount') ?? 0),
    });
    e.currentTarget.reset();
  };

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-border-custom bg-surface-2/40 p-4">
      <p className="text-xs text-text-muted">
        Ceny na żywo z CoinGecko — wpisz ilość tokenów, bez dostępu do portfela.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-[var(--space-2)]">
        <ControlInput
          name="name"
          placeholder="Nazwa (np. Ledger, giełda)"
          required
          className="min-h-11 min-w-[8rem] flex-1 rounded-[var(--radius-md)] border border-border-custom bg-surface-1 px-3 py-2 text-sm"
        />
        <ControlSelect
          name="coin"
          defaultValue="bitcoin"
          required
          className="min-h-11 min-w-[10rem] rounded-[var(--radius-md)] border border-border-custom bg-surface-1 px-3 py-2 text-sm"
        >
          {COINGECKO_COINS.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
          ))}
        </ControlSelect>
        <ControlInput
          name="amount"
          type="number"
          step="any"
          min="0"
          placeholder="Ilość"
          required
          className="min-h-11 w-28 rounded-[var(--radius-md)] border border-border-custom bg-surface-1 px-3 py-2 text-sm"
        />
        <Button type="submit" size="sm">Dodaj</Button>
      </form>
    </div>
  );
}

interface BrokerManualHintProps {
  accountType: string;
}

export function BrokerManualHint({ accountType }: BrokerManualHintProps) {
  if (accountType !== 'stocks' && accountType !== 'etf') return null;
  return (
    <p className="text-xs text-text-muted">
      Broker (XTB itd.) — saldo wpisujesz ręcznie. Bez auto-sync, dopóki nie chcesz ruszać pozycji.
    </p>
  );
}
