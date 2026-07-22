import { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import type { DividendRecord } from '@vanguard/domain';

interface DividendAddFormProps {
  onAdd: (record: DividendRecord) => void;
}

export function DividendAddForm({ onAdd }: DividendAddFormProps) {
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newPayDate, setNewPayDate] = useState('');

  const handleAddDividend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker || !newAmount || !newShares || !newPayDate) return;

    const amt = parseFloat(newAmount);
    const shs = parseFloat(newShares);
    const newItem: DividendRecord = {
      id: Date.now().toString(),
      ticker: newTicker.toUpperCase(),
      companyName: newName || newTicker.toUpperCase(),
      amountPerShare: amt,
      sharesCount: shs,
      totalAmount: amt * shs,
      currency: 'PLN',
      exDate: newPayDate,
      payDate: newPayDate,
      status: 'expected',
    };

    onAdd(newItem);
    setNewTicker('');
    setNewName('');
    setNewAmount('');
    setNewShares('');
    setNewPayDate('');
  };

  return (
    <form onSubmit={handleAddDividend} className="p-3 bg-surface-2/40 rounded-xl space-y-3 border border-border-custom/30">
      <h4 className="text-xs font-medium text-text-primary">Zaplanuj Wypłatę Dywidendy</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Input
          size="sm"
          placeholder="Ticker (np. VWCE.DE)"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
          required
        />
        <Input
          size="sm"
          placeholder="Nazwa Spółki / ETF"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Input
          size="sm"
          type="number"
          step="0.01"
          placeholder="Dywidenda/akcja PLN"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          required
        />
        <Input
          size="sm"
          type="number"
          step="1"
          placeholder="Liczba akcji"
          value={newShares}
          onChange={(e) => setNewShares(e.target.value)}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <Input
          size="sm"
          type="date"
          value={newPayDate}
          onChange={(e) => setNewPayDate(e.target.value)}
          required
        />
        <Button type="submit" variant="tonal" size="sm" className="slate-pill text-xs font-medium">
          Zapisz Dywidendę
        </Button>
      </div>
    </form>
  );
}
