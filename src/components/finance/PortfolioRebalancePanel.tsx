import { useState } from 'react';
import { Card } from '../ui/Card';
import { Scale, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { calculatePortfolioRebalance, type HoldingTarget } from '@vanguard/domain';

export default function PortfolioRebalancePanel() {
  const [targets] = useState<HoldingTarget[]>([
    { id: '1', ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World ETF', assetCategory: 'etf', targetPct: 50 },
    { id: '2', ticker: 'AAPL', name: 'Apple Inc.', assetCategory: 'stocks', targetPct: 20 },
    { id: '3', ticker: 'BTC', name: 'Bitcoin', assetCategory: 'crypto', targetPct: 15 },
    { id: '4', ticker: 'CASH', name: 'Gotówka / Rezerwa', assetCategory: 'cash', targetPct: 15 },
  ]);

  const currentHoldings = [
    { ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World ETF', currentValue: 42000 },
    { ticker: 'AAPL', name: 'Apple Inc.', currentValue: 28000 },
    { ticker: 'BTC', name: 'Bitcoin', currentValue: 8000 },
    { ticker: 'CASH', name: 'Gotówka / Rezerwa', currentValue: 22000 },
  ];

  const recommendations = calculatePortfolioRebalance(currentHoldings, targets);
  const totalTargetPct = targets.reduce((sum: number, t: HoldingTarget) => sum + t.targetPct, 0);

  return (
    <Card padding="1.25rem" className="slate-card space-y-4 text-text-primary">
      <div className="flex items-center justify-between gap-2 border-b border-border-custom/30 pb-3">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-primary shrink-0" />
          <div>
            <h3 className="text-xs font-medium tracking-tight text-text-primary">Asystent Rebalansowania Portfela (Rebalancing)</h3>
            <p className="text-2xs text-text-muted">Porównanie obecnej alokacji z Twoim docelowym modelem</p>
          </div>
        </div>
        <span className={`text-2xs font-medium px-2 py-0.5 slate-pill ${totalTargetPct === 100 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          Suma Celów: {totalTargetPct}% {totalTargetPct !== 100 && '(Wymaga 100%)'}
        </span>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div key={rec.ticker} className="p-3 bg-surface-2/30 rounded-xl border border-border-custom/20 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xs px-2 py-0.5 rounded bg-surface-2 text-text-primary font-bold">{rec.ticker}</span>
                <span className="font-medium text-text-primary">{rec.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-text-muted">Obecnie: {rec.currentPct}%</span>
                <ArrowRight size={10} className="text-text-muted" />
                <span className="text-2xs font-bold text-primary">Cel: {rec.targetPct}%</span>
              </div>
            </div>

            <div className="w-full bg-surface-solid rounded-full h-1.5 overflow-hidden flex">
              <div className="bg-primary h-full" style={{ width: `${Math.min(rec.currentPct, 100)}%` }} />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-2xs text-text-muted">Obecna Wartość: {rec.currentValue.toLocaleString('pl-PL')} PLN</span>
              {rec.actionType === 'buy' ? (
                <span className="text-2xs font-bold text-success flex items-center gap-1">
                  <CheckCircle2 size={10} /> Dokup za +{rec.recommendedActionValue.toLocaleString('pl-PL')} PLN
                </span>
              ) : rec.actionType === 'sell' ? (
                <span className="text-2xs font-bold text-warning flex items-center gap-1">
                  <AlertTriangle size={10} /> Sprzedaj / Zredukuj {Math.abs(rec.recommendedActionValue).toLocaleString('pl-PL')} PLN
                </span>
              ) : (
                <span className="text-2xs font-medium text-text-muted">Idealna alokacja (Bez zmian)</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
