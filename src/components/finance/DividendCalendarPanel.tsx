import { useState } from 'react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { Calendar, DollarSign, TrendingUp, Plus } from 'lucide-react';
import { calculate12MonthDividendForecast, type DividendRecord } from '@vanguard/domain';
import { DividendAddForm } from './DividendAddForm';

export default function DividendCalendarPanel() {
  const [dividends, setDividends] = useState<DividendRecord[]>([
    {
      id: '1',
      ticker: 'VWCE.DE',
      companyName: 'Vanguard FTSE All-World ETF',
      amountPerShare: 2.15,
      sharesCount: 120,
      totalAmount: 258,
      currency: 'PLN',
      exDate: '2026-06-12',
      payDate: '2026-06-26',
      status: 'expected',
    },
    {
      id: '2',
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      amountPerShare: 0.95,
      sharesCount: 50,
      totalAmount: 189.5,
      currency: 'PLN',
      exDate: '2026-08-10',
      payDate: '2026-08-24',
      status: 'expected',
    },
    {
      id: '3',
      ticker: 'PKO.WA',
      companyName: 'PKO Bank Polski',
      amountPerShare: 2.60,
      sharesCount: 300,
      totalAmount: 780,
      currency: 'PLN',
      exDate: '2026-09-18',
      payDate: '2026-10-02',
      status: 'expected',
    },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const forecast = calculate12MonthDividendForecast(dividends);

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card padding="1rem" className="slate-card space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-text-muted font-medium uppercase">
            <DollarSign size={12} className="text-success" />
            Prognoza 12 Miesięcy
          </div>
          <p className="text-xl font-bold text-text-primary">{forecast.total12MonthForecast.toLocaleString('pl-PL')} PLN</p>
          <p className="text-2xs text-text-muted">Szacowany roczny dochód pasywny</p>
        </Card>

        <Card padding="1rem" className="slate-card space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-text-muted font-medium uppercase">
            <TrendingUp size={12} className="text-primary" />
            Średnio Miesięcznie
          </div>
          <p className="text-xl font-bold text-text-primary">{forecast.averageMonthlyIncome.toLocaleString('pl-PL')} PLN / mc</p>
          <p className="text-2xs text-text-muted">Kaskada wypłat dywidendowych</p>
        </Card>

        <Card padding="1rem" className="slate-card space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-text-muted font-medium uppercase">
            <Calendar size={12} className="text-warning" />
            Nadchodzące Wypłaty
          </div>
          <p className="text-xl font-bold text-text-primary">{dividends.length} Wypłat</p>
          <p className="text-2xs text-text-muted">Zaplanowane dywidendy w portfelu</p>
        </Card>
      </div>

      {/* Main Table & Controls */}
      <Card padding="1.25rem" className="slate-card space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-border-custom/30 pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-primary shrink-0" />
            <div>
              <h3 className="text-xs font-medium tracking-tight text-text-primary">Kalendarz & Kaskada Dywidend (Snowball)</h3>
              <p className="text-2xs text-text-muted">Harmonogram ex-date i pay-date dla posiadanych aktywów</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            icon={<Plus size={12} />}
            className="slate-pill text-xs font-medium"
          >
            {showAddForm ? 'Anuluj' : 'Dodaj Dywidendę'}
          </Button>
        </div>

        {showAddForm && (
          <DividendAddForm
            onAdd={(newItem) => {
              setDividends([...dividends, newItem]);
              setShowAddForm(false);
            }}
          />
        )}

        <div className="space-y-2">
          {dividends.map((div) => (
            <div key={div.id} className="flex items-center justify-between p-2.5 bg-surface-2/30 rounded-xl border border-border-custom/20 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">{div.ticker}</span>
                <div>
                  <p className="font-medium text-text-primary">{div.companyName}</p>
                  <p className="text-2xs text-text-muted">Data wypłaty: {div.payDate} • Ex-date: {div.exDate}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-success">+{div.totalAmount.toLocaleString('pl-PL')} {div.currency}</p>
                <p className="text-2xs text-text-muted">{div.sharesCount} akcji × {div.amountPerShare} PLN</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
