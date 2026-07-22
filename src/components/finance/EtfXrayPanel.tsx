import { Card } from '../ui/Card';
import { Layers } from 'lucide-react';

export default function EtfXrayPanel() {
  const etfHoldings = [
    { company: 'Apple Inc. (AAPL)', directPct: 12.5, viaEtfPct: 4.8, totalEffectivePct: 17.3 },
    { company: 'Microsoft Corp. (MSFT)', directPct: 0.0, viaEtfPct: 4.2, totalEffectivePct: 4.2 },
    { company: 'NVIDIA Corp. (NVDA)', directPct: 0.0, viaEtfPct: 3.9, totalEffectivePct: 3.9 },
    { company: 'Amazon.com Inc. (AMZN)', directPct: 0.0, viaEtfPct: 2.6, totalEffectivePct: 2.6 },
    { company: 'Alphabet Inc. (GOOGL)', directPct: 0.0, viaEtfPct: 2.1, totalEffectivePct: 2.1 },
  ];

  return (
    <Card padding="1.25rem" className="slate-card space-y-4 text-text-primary">
      <div className="flex items-center justify-between gap-2 border-b border-border-custom/30 pb-3">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary shrink-0" />
          <div>
            <h3 className="text-xs font-medium tracking-tight text-text-primary">X-Ray Portfela & ETF-ów</h3>
            <p className="text-2xs text-text-muted">Rzeczywista ekspozycja na spółki poprzez bezpośrednie akcje oraz fundusze ETF</p>
          </div>
        </div>
        <span className="text-2xs font-medium px-2 py-0.5 slate-pill bg-primary/10 text-primary">
          Agregacja X-Ray Active
        </span>
      </div>

      <div className="space-y-2.5">
        {etfHoldings.map((h) => (
          <div key={h.company} className="p-3 bg-surface-2/30 rounded-xl border border-border-custom/20 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-text-primary">{h.company}</span>
              <span className="font-bold text-primary">{h.totalEffectivePct}% Portfela</span>
            </div>
            <div className="flex items-center justify-between text-2xs text-text-muted">
              <span>Bezpośrednie akcje: {h.directPct}%</span>
              <span>Udział w ETF (VWCE/S&P500): {h.viaEtfPct}%</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
