import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ImpactFactor } from '@vanguard/domain';
import { CATEGORY_LABELS, rColor } from '@vanguard/domain';
import { Card } from '../ui/Card';
import Button from '../ui/Button';
import { useNOf1Store } from '../../store/nOf1Store';
import { notify } from '../../lib/notify';
import { Play } from 'lucide-react';

interface Props {
  item: ImpactFactor;
  expanded?: boolean;
  showExperimentButton?: boolean;
}

function MiniTip({ active, payload }: { active?: boolean; payload?: { payload: { day: string; x: number; y: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-custom bg-surface px-2 py-1 text-xs shadow-md">
      <p className="text-text-muted">{p.day}</p>
      <p className="font-semibold text-text-primary">{p.x.toFixed(1)} → {p.y.toFixed(1)}</p>
    </div>
  );
}

export default function CorrelationCard({ item, expanded = false, showExperimentButton = false }: Props) {
  const color = rColor(item.r);
  const showChart = item.scatter.length >= 3;
  const { experiments, startExperiment } = useNOf1Store();

  const activeExp = experiments.find(
    (e) => e.factorKey === item.x_metric && e.outcomeKey === item.y_metric && e.status === 'active'
  );

  const handleStartExperiment = () => {
    const condition = `Wprowadź/kontroluj czynnik: ${item.x_label} (optymalizacja)`;
    startExperiment(item.x_metric, item.x_label, item.y_metric, item.y_label, 14, condition);
    notify(`Uruchomiono eksperyment N-of-1: ${item.x_label} vs ${item.y_label}`, 'success');
  };

  const getTierConfig = (tier: string) => {
    switch (tier) {
      case 'confirmed':
        return { label: 'Potwierdzony', bg: 'bg-success/10 text-success border-success/20' };
      case 'probable':
        return { label: 'Prawdopodobny', bg: 'bg-primary/10 text-primary border-primary/20' };
      case 'hypothesis':
        return { label: 'Hipoteza', bg: 'bg-warning/10 text-warning border-warning/20' };
      default:
        return { label: 'Brak dowodu', bg: 'bg-surface-solid text-text-muted border-border-custom' };
    }
  };

  const tier = getTierConfig(item.evidence_level);

  return (
    <Card
      variant="surface"
      padding="1.25rem"
      className={`border transition-all duration-[var(--motion-medium)] ${
        item.evidence_level === 'confirmed' ? 'border-success/20 hover:border-success/40' :
        item.evidence_level === 'probable' ? 'border-primary/20 hover:border-primary/40' :
        'border-border-custom hover:border-border-custom-hover'
      }`}
    >
      <div className="flex flex-col gap-2">
        {/* Badges strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-3xs font-black uppercase tracking-widest text-text-muted px-1.5 py-0.5 rounded bg-surface-solid border border-border-custom/50">
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
          <span className={`text-3xs font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${tier.bg}`}>
            {tier.label}
          </span>
          <span className="text-3xs font-black uppercase tracking-widest text-text-muted px-1.5 py-0.5 rounded bg-surface-solid border border-border-custom/50">
            N={item.n}
          </span>
          {activeExp && (
            <span className="text-3xs font-black uppercase tracking-widest bg-success/15 text-success px-1.5 py-0.5 rounded border border-success/20 animate-pulse">
              Eksperyment w toku
            </span>
          )}
        </div>

        {/* Title & Natural effect size */}
        <div className="flex items-start justify-between gap-4 mt-1">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-text-primary leading-snug">
              {item.x_label} ➔ {item.y_label}
            </h3>
            <p className="text-xs text-text-secondary mt-1 font-medium">
              Powiązany z: <span className="text-text-primary font-bold">{item.natural_effect}</span>
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black tabular-nums leading-none" style={{ color: color }}>
              {item.r > 0 ? '+' : ''}{item.r.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Notes / Descriptions */}
        <div className="text-xs text-text-muted leading-relaxed mt-1">
          {item.evidence_level === 'confirmed' && (
            <p>Silny i czasowo stabilny wpływ czynnika. Występuje w obu połowach badanego okresu.</p>
          )}
          {item.evidence_level === 'probable' && (
            <p>Spójny kierunek wpływu, lecz wymaga zgromadzenia większej próby dla pełnego potwierdzenia.</p>
          )}
          {item.evidence_level === 'hypothesis' && (
            <p>Dostrzegalny trend w danych. Przetestuj czynnik w kontrolowanym eksperymencie, aby potwierdzić wpływ.</p>
          )}
          {item.evidence_level === 'no_evidence' && (
            <p>Brak jednoznacznego statystycznego dowodu na powiązanie w dotychczasowych logach.</p>
          )}
        </div>

        {/* Hypothesis Call-to-action button */}
        {showExperimentButton && item.evidence_level === 'hypothesis' && !activeExp && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartExperiment}
            className="flex items-center justify-center gap-1.5 w-full mt-3 text-success hover:bg-success/10 border-success/20"
          >
            <Play size={12} className="fill-current animate-pulse" />
            Sprawdź przez 14 dni
          </Button>
        )}

        {/* Details section inside evidence archive */}
        {expanded && (
          <div className="mt-4 pt-3 border-t border-border-custom/60 space-y-3">
            {showChart && (
              <div className="h-[var(--ds-h-140px)] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" opacity={0.4} />
                    <XAxis
                      dataKey="x"
                      type="number"
                      name={item.x_label}
                      tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }}
                    />
                    <YAxis
                      dataKey="y"
                      type="number"
                      name={item.y_label}
                      tick={{ fontSize: 8, fill: 'var(--color-text-muted)' }}
                      width={32}
                    />
                    <Tooltip content={<MiniTip />} />
                    <Scatter data={item.scatter} fill={color} fillOpacity={0.6} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-2xs text-text-muted pt-1">
              <div>
                <p>Metoda: <span className="font-semibold text-text-secondary">{item.method}</span></p>
                <p>P-value: <span className="font-semibold text-text-secondary">p={item.p.toFixed(4)}</span></p>
              </div>
              <div>
                <p>Stabilność: <span className={`font-semibold ${item.is_stable ? 'text-success' : 'text-text-muted'}`}>{item.is_stable ? 'Stabilny' : 'Brak stabilności'}</span></p>
                <p>CI (95%): <span className="font-semibold text-text-secondary">[{item.ci_lower.toFixed(2)}, {item.ci_upper.toFixed(2)}]</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
