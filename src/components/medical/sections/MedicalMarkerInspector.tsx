import Sheet from '../../ui/Sheet';
import type { MedicalLabRow } from '../../../lib/health/medicalAnalytics';
import { Card } from '../../ui/Card';
import { AlertTriangle, Calendar, Info, FlaskConical } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface MedicalMarkerInspectorProps {
  markerKey: string | null;
  labs: MedicalLabRow[];
  onClose: () => void;
}

export default function MedicalMarkerInspector({ markerKey, labs, onClose }: MedicalMarkerInspectorProps) {
  const isOpen = !!markerKey;

  // Filter and sort historical rows for this marker (newest first for table, oldest first for chart)
  const history = labs
    .filter(l => l.marker_key === markerKey)
    .sort((a, b) => b.result_date.localeCompare(a.result_date));

  const chartData = [...history]
    .sort((a, b) => a.result_date.localeCompare(b.result_date))
    .map(h => ({
      date: h.result_date,
      value: h.value
    }));

  const latest = history[0];
  if (!latest) return null;

  const hasFlag = latest.flag && latest.flag !== 'N' && latest.flag !== 'normal';
  const normStr = latest.ref_low != null && latest.ref_high != null
    ? `${latest.ref_low} – ${latest.ref_high}`
    : latest.ref_text || 'Brak danych referencyjnych';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} title={latest.marker_name}>
      <div className="space-y-6">
        {/* Header Alert if out of bounds */}
        {hasFlag && (
          <div className="rounded-xl border border-warning/30 bg-warning/[0.04] p-3 flex gap-2 items-start">
            <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary">
              <span className="font-bold text-text-primary">Odchylenie od normy.</span> Ostatnia wartość ({latest.value} {latest.unit}) znajduje się poza zalecanym zakresem laboratoryjnym ({normStr}).
            </div>
          </div>
        )}

        {/* Latest Value Hero */}
        <div className="bg-background/40 border border-border-custom rounded-2xl p-4 flex justify-between items-center">
          <div>
            <span className="text-3xs font-black uppercase text-text-muted tracking-wider">Ostatni Pomiar</span>
            <p className="text-2xl font-black text-text-primary mt-1">
              {latest.value} <span className="text-sm font-bold text-text-muted uppercase">{latest.unit}</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xs font-black uppercase text-text-muted tracking-wider">Zakres Norma</span>
            <p className="text-sm font-bold text-text-secondary mt-1 font-mono">{normStr}</p>
          </div>
        </div>

        {/* Sparkline / History Chart */}
        {chartData.length >= 2 ? (
          <div className="space-y-2">
            <span className="text-3xs font-black uppercase text-text-muted tracking-wider">Historia Trendu ({chartData.length} pomiary)</span>
            <div className="h-32 w-full bg-background/20 border border-border-custom rounded-2xl p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" tickFormatter={(str) => str.slice(2)} tick={{ fontSize: 9 }} stroke="var(--border-custom)" />
                  <YAxis tick={{ fontSize: 9 }} stroke="var(--border-custom)" domain={['dataMin - 10%', 'dataMax + 10%']} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-solid)', borderColor: 'var(--border-custom)', borderRadius: '12px' }}
                    labelClassName="text-3xs font-bold text-text-muted"
                  />
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted italic bg-background/10 rounded-xl p-3 border border-border-custom/50">
            Dwa pomiary pokazują zmianę. Do wyznaczenia wiarygodnego trendu potrzebne są przynajmniej 2 punkty pomiarowe.
          </p>
        )}

        {/* Full Measurements List */}
        <div className="space-y-3">
          <span className="text-3xs font-black uppercase text-text-muted tracking-wider block">Wszystkie Wpisy</span>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {history.map((row, i) => (
              <Card key={row.id || i} variant="outline" padding="0.75rem" className="bg-background/10 border-border-custom/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Calendar size={12} className="text-text-muted" />
                    {row.result_date}
                  </span>
                  <span className="text-xs font-black text-text-primary">
                    {row.value} {row.unit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-3xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <FlaskConical size={10} />
                    {row.provider || row.source_name || 'Brak źródła'}
                  </span>
                  {row.flag && row.flag !== 'N' && (
                    <span className="text-warning font-black uppercase">Poza normą ({row.flag})</span>
                  )}
                </div>
                {row.notes && (
                  <p className="text-3xs text-text-muted bg-background/40 p-1.5 rounded border border-border-custom/30 mt-1">
                    Context: {row.notes}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
