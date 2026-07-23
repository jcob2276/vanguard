import { useState, useMemo } from 'react';
import { Card } from '../../ui/Card';
import { TrendingUp, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import type { MedicalLabRow } from '../../../lib/health/medicalAnalytics';
import { Pressable } from '../../ui/ControlPrimitives';

interface MedicalTrendsProps {
  labs: MedicalLabRow[];
}

function analyzeMedicalTrends(labs: MedicalLabRow[]) {
  const historyByMarker = new Map<string, MedicalLabRow[]>();
  for (const row of labs) {
    historyByMarker.set(row.marker_key, [...(historyByMarker.get(row.marker_key) ?? []), row]);
  }
  for (const [key, rows] of historyByMarker) {
    historyByMarker.set(key, rows.sort((a, b) => a.result_date.localeCompare(b.result_date)));
  }
  const allTrends = [...historyByMarker.entries()].flatMap(([key, history]) => {
    if (history.length < 2) return [];
    const previous = history.at(-2)!;
    const current = history.at(-1)!;
    const absoluteChange = current.value - previous.value;
    return [{
      key,
      name: current.marker_name,
      pctChange: previous.value === 0 ? 0 : (absoluteChange / previous.value) * 100,
      absoluteChange,
      unit: current.unit || '',
      currentValue: current.value,
      prevValue: previous.value,
      history,
    }];
  }).sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  return {
    allTrends,
    largestChanges: allTrends.filter((trend) => Math.abs(trend.pctChange) >= 10).slice(0, 4),
    stable: allTrends.filter((trend) => Math.abs(trend.pctChange) < 10),
  };
}

export default function MedicalTrends({ labs }: MedicalTrendsProps) {
  const [selectedChartKey, setSelectedChartKey] = useState<string | null>(null);
  const trendAnalysis = useMemo(() => analyzeMedicalTrends(labs), [labs]);

  const selectedTrend = trendAnalysis.allTrends.find(t => t.key === (selectedChartKey || trendAnalysis.allTrends[0]?.key));

  return (
    <div className="space-y-6">
      <div className="border-b border-border-custom/50 pb-3">
        <h2 className="text-lg font-black uppercase font-display">3. Trendy i Zmienność</h2>
        <p className="text-2xs text-text-muted mt-0.5">Analiza długoterminowa i dynamika zmian parametrów</p>
      </div>

      {trendAnalysis.allTrends.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <span className="text-2xs font-black uppercase tracking-wider text-text-muted">Synteza Zmian</span>
            
            <div className="space-y-2">
              <span className="text-3xs font-black uppercase tracking-wider text-text-muted">Największe przesunięcia (≥10%)</span>
              {trendAnalysis.largestChanges.map(s => (
                <Pressable
                  key={s.key}
                  onClick={() => setSelectedChartKey(s.key)}
                  className={`w-full text-left rounded-xl p-3 border transition-all flex items-center justify-between ${
                    selectedChartKey === s.key || (!selectedChartKey && s.key === trendAnalysis.allTrends[0]?.key)
                      ? 'border-primary/50 bg-primary/[0.03]'
                      : 'border-border-custom bg-background/20 hover:bg-background/40'
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">{s.name}</h4>
                    <span className="text-3xs text-text-muted">{s.history[s.history.length - 1].result_date}</span>
                  </div>
                  <span className={`text-xs font-black flex items-center gap-0.5 ${s.pctChange > 0 ? 'text-primary' : 'text-text-muted'}`}>
                    <TrendingUp size={12} className={s.pctChange < 0 ? 'rotate-180' : ''} />
                    {s.pctChange > 0 ? '+' : ''}{s.pctChange.toFixed(0)}%
                  </span>
                </Pressable>
              ))}
              {trendAnalysis.largestChanges.length === 0 && (
                <p className="text-3xs text-text-muted italic">Brak gwałtownych wahań w markerach.</p>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-3xs font-black uppercase tracking-wider text-text-muted">Stabilne wskaźniki (&lt;10%)</span>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {trendAnalysis.stable.map(s => (
                  <Pressable
                    key={s.key}
                    onClick={() => setSelectedChartKey(s.key)}
                    className={`w-full text-left rounded-lg px-2.5 py-1.5 border transition-all flex items-center justify-between text-xs ${
                      selectedChartKey === s.key
                        ? 'border-primary/40 bg-primary/[0.02]'
                        : 'border-border-custom/50 bg-background/10 hover:bg-background/20'
                    }`}
                  >
                    <span className="font-semibold text-text-secondary">{s.name}</span>
                    <span className="text-text-muted font-bold flex items-center gap-0.5 text-2xs">
                      <Minus size={10} />
                      {Math.abs(s.pctChange).toFixed(1)}%
                    </span>
                  </Pressable>
                ))}
              </div>
            </div>
          </div>

          {selectedTrend && (
            <Card variant="surface" padding="1.25rem" className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xs font-black uppercase text-primary tracking-wider">Szczegóły Trendu</span>
                  <h3 className="text-base font-black text-text-primary">{selectedTrend.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-3xs font-black uppercase text-text-muted tracking-wider">Pomiary</span>
                  <p className="text-xs font-bold text-text-secondary">{selectedTrend.history.length} razy</p>
                </div>
              </div>

              <div className="h-52 w-full bg-background/30 rounded-2xl p-2 border border-border-custom/60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedTrend.history} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-custom)" opacity={0.1} />
                    <XAxis dataKey="result_date" tick={{ fontSize: 9 }} stroke="var(--border-custom)" />
                    <YAxis tick={{ fontSize: 9 }} stroke="var(--border-custom)" domain={['dataMin - 10%', 'dataMax + 10%']} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface-solid)', borderColor: 'var(--border-custom)', borderRadius: '12px' }}
                      labelClassName="text-3xs font-bold text-text-muted"
                    />
                    <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4 text-3xs font-semibold text-text-secondary pt-2">
                <div className="bg-background/20 p-2 rounded-xl border border-border-custom/40">
                  <span className="text-text-muted uppercase font-black block">Kontekst Pomiaru</span>
                  <p className="mt-1 text-xs">{selectedTrend.history[selectedTrend.history.length - 1].notes || 'Brak wpisanych uwag / kontekstu (leki, trening, post)'}</p>
                </div>
                <div className="bg-background/20 p-2 rounded-xl border border-border-custom/40">
                  <span className="text-text-muted uppercase font-black block">Laboratorium / Dostawca</span>
                  <p className="mt-1 text-xs">{selectedTrend.history[selectedTrend.history.length - 1].provider || 'Nieokreślone'}</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border-custom py-12 text-center">
          <p className="text-xs text-text-muted italic">Zbyt mało powtarzalnych pomiarów badań, aby wyznaczyć trendy.</p>
        </div>
      )}
    </div>
  );
}
