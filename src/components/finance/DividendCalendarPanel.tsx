import { useState } from 'react';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { Calendar, DollarSign, TrendingUp, Plus, ShieldCheck } from 'lucide-react';
import { calculate12MonthDividendForecast, evaluateDividendSafety, type DividendRecord } from '@vanguard/domain';
import { DividendAddForm } from './DividendAddForm';
import { useYahooQuotes } from '../../lib/yahooFinanceApi';

export default function DividendCalendarPanel() {
  const [dividends, setDividends] = useState<DividendRecord[]>([
    {
      id: '1',
      ticker: 'VWCE.DE',
      companyName: 'Vanguard FTSE All-World ETF (IKE)',
      amountPerShare: 2.15,
      sharesCount: 120,
      totalAmount: 258,
      currency: 'PLN',
      exDate: '2026-06-12',
      payDate: '2026-06-26',
      status: 'expected',
      payoutRatioPct: 40,
      isIkeAccount: true,
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
      payoutRatioPct: 15,
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
      payoutRatioPct: 65,
    },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showNet, setShowNet] = useState(true);

  const tickers = dividends.map((d) => d.ticker);
  useYahooQuotes(tickers);

  const forecast = calculate12MonthDividendForecast(dividends, { applyBelkaTax: showNet, w8BenRatePct: 15 });
  const safetyRatings = evaluateDividendSafety(dividends);

  const displayTotal = showNet ? forecast.total12MonthForecastNet : forecast.total12MonthForecastGross;
  const displayMonthly = showNet ? forecast.averageMonthlyIncomeNet : Math.round((forecast.total12MonthForecastGross / 12) * 100) / 100;

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card padding="1rem" className="slate-card space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-2xs text-text-muted font-medium uppercase">
              <DollarSign size={12} className="text-success" />
              Prognoza 12M ({showNet ? 'Netto Belka 19%' : 'Brutto'})
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNet(!showNet)}
              className="slate-pill text-3xs px-1.5 py-0.5"
            >
              {showNet ? 'Pokaż Brutto' : 'Pokaż Netto'}
            </Button>
          </div>
          <p className="text-xl font-bold text-text-primary">{displayTotal.toLocaleString('pl-PL')} PLN</p>
          <p className="text-2xs text-text-muted">Szacowany roczny dochód pasywny</p>
        </Card>

        <Card padding="1rem" className="slate-card space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-text-muted font-medium uppercase">
            <TrendingUp size={12} className="text-primary" />
            Średnio Miesięcznie ({showNet ? 'Netto' : 'Brutto'})
          </div>
          <p className="text-xl font-bold text-text-primary">{displayMonthly.toLocaleString('pl-PL')} PLN / mc</p>
          <p className="text-2xs text-text-muted">Kaskada wypłat dywidendowych</p>
        </Card>

        <Card padding="1rem" className="slate-card space-y-1">
          <div className="flex items-center gap-1.5 text-2xs text-text-muted font-medium uppercase">
            <ShieldCheck size={12} className="text-success" />
            Dividend Safety Rating
          </div>
          <p className="text-xl font-bold text-success">Bezpieczny (Score: 82/100)</p>
          <p className="text-2xs text-text-muted">Niskie ryzyko ścięcia dywidend</p>
        </Card>
      </div>

      {/* Main Table & Controls */}
      <Card padding="1.25rem" className="slate-card space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-border-custom/30 pb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-primary shrink-0" />
            <div>
              <h3 className="text-xs font-medium tracking-tight text-text-primary">Kalendarz & Safety Rating Dywidend (Snowball)</h3>
              <p className="text-2xs text-text-muted">Wskaźnik bezpieczeństwa Payout Ratio oraz harmonogram wypłat</p>
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
          {dividends.map((div) => {
            const safety = safetyRatings.find((s) => s.ticker === div.ticker);
            return (
              <div key={div.id} className="flex items-center justify-between p-2.5 bg-surface-2/30 rounded-xl border border-border-custom/20 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">{div.ticker}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-primary">{div.companyName}</p>
                      {safety && (
                        <span className={`text-3xs font-medium px-1.5 py-0.2 slate-pill ${safety.safetyLevel === 'safe' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                          Safety: {safety.score}/100
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-text-muted">Data wypłaty: {div.payDate} • Ex-date: {div.exDate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-success">+{div.totalAmount.toLocaleString('pl-PL')} {div.currency}</p>
                  <p className="text-2xs text-text-muted">{div.sharesCount} akcji × {div.amountPerShare} PLN</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
