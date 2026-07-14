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
    <div className="grid gap-4 relative z-10" style={{ gridTemplateColumns: `repeat(${metricCols}, 1fr)` }}>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Strain</p>
        <p className={`text-[19px] font-black leading-none mt-0.5 ${strainTone}`}>
          {strainScore ?? '--'}<span className="text-[9px] text-text-muted font-normal">/21</span>
        </p>
        <div className="mt-1.5 h-[2px] bg-border-custom/40 rounded-full">
          <div className="h-[2px] rounded-full bg-warning transition-all" style={{ width: `${Math.min(100, (strainScore / 21) * 100)}%` }} />
        </div>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Recovery</p>
        <p className={`text-[19px] font-black leading-none mt-0.5 ${recovTone}`}>
          {recoveryScore ?? '--'}<span className="text-[9px] text-text-muted font-normal">/100</span>
        </p>
        <div className="mt-1.5 h-[2px] bg-border-custom/40 rounded-full">
          <div className={`h-[2px] rounded-full transition-all ${recoveryScore >= 75 ? 'bg-success' : recoveryScore >= 55 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${Math.min(100, recoveryScore)}%` }} />
        </div>
      </div>

      {fuelingScore != null && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Fueling</p>
          <p className={`text-[19px] font-black leading-none mt-0.5 ${fuelingScore >= 70 ? 'text-success' : 'text-warning'}`}>
            {fuelingScore}<span className="text-[9px] text-text-muted font-normal">/100</span>
          </p>
          <div className="mt-1.5 h-[2px] bg-border-custom/40 rounded-full">
            <div className={`h-[2px] rounded-full transition-all ${fuelingScore >= 70 ? 'bg-success' : 'bg-warning'}`} style={{ width: `${Math.min(100, fuelingScore)}%` }} />
          </div>
        </div>
      )}

      {sleepDebtH != null && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
            {sleepDebtH < 0 ? 'Dług snu' : 'Nadwyżka'}
          </p>
          <p className={`text-[19px] font-black leading-none mt-0.5 ${sleepDebtH < -0.5 ? 'text-danger' : sleepDebtH > 0.5 ? 'text-success' : 'text-text-primary'}`}>
            {sleepDebtH < 0 ? `${Math.abs(sleepDebtH)}h` : sleepDebtH > 0 ? `+${sleepDebtH}h` : '–'}
          </p>
        </div>
      )}
    </div>
  );
}
