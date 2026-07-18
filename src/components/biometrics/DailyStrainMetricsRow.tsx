/**
 * @component DailyStrainMetricsRow
 * @role Wiersz metryk strain/recovery (StatHero).
 * @usedBy DailyStrainCard
 */
import { StatHero } from '../ui/StatHero';

interface DailyStrainMetricsRowProps {
  strainScore: number;
  strainTone: string;
  recoveryScore: number;
  recovTone: string;
  fuelingScore?: number | null;
  sleepDebtH?: number | null;
}

export default function DailyStrainMetricsRow({
  strainScore,
  strainTone,
  recoveryScore,
  recovTone,
  fuelingScore,
  sleepDebtH,
}: DailyStrainMetricsRowProps) {
  const metricCols = 2 + (fuelingScore != null ? 1 : 0) + (sleepDebtH != null ? 1 : 0);

  return (
    <div className="grid gap-4 relative z-[var(--z-raised)]" style={{ gridTemplateColumns: `repeat(${metricCols}, 1fr)` }}>
      <div>
        <StatHero value={strainScore ?? '--'} label="Strain" suffix="/21" color={strainTone} size="sm" />
        <div className="mt-1.5 h-[var(--ds-h-2px)] bg-border-custom/40 rounded-full">
          <div className="h-[var(--ds-h-2px)] rounded-full bg-warning transition-all" style={{ width: `${Math.min(100, (strainScore / 21) * 100)}%` }} />
        </div>
      </div>

      <div>
        <StatHero value={recoveryScore ?? '--'} label="Recovery" suffix="/100" color={recovTone} size="sm" />
        <div className="mt-1.5 h-[var(--ds-h-2px)] bg-border-custom/40 rounded-full">
          <div className={`h-[var(--ds-h-2px)] rounded-full transition-all ${recoveryScore >= 75 ? 'bg-success' : recoveryScore >= 55 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${Math.min(100, recoveryScore)}%` }} />
        </div>
      </div>

      {fuelingScore != null && (
        <div>
          <StatHero value={fuelingScore} label="Fueling" suffix="/100" color={fuelingScore >= 70 ? 'text-success' : 'text-warning'} size="sm" />
          <div className="mt-1.5 h-[var(--ds-h-2px)] bg-border-custom/40 rounded-full">
            <div className={`h-[var(--ds-h-2px)] rounded-full transition-all ${fuelingScore >= 70 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${Math.min(100, fuelingScore)}%` }} />
          </div>
        </div>
      )}

      {sleepDebtH != null && (
        <div>
          <StatHero
            value={sleepDebtH < 0 ? `${Math.abs(sleepDebtH)}h` : sleepDebtH > 0 ? `+${sleepDebtH}h` : '–'}
            label={sleepDebtH < 0 ? 'Dług snu' : 'Nadwyżka'}
            color={sleepDebtH < -0.5 ? 'text-danger' : sleepDebtH > 0.5 ? 'text-success' : 'text-text-primary'}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
