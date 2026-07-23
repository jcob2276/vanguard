import type { MedicalLabRow } from '../../lib/health/medicalAnalytics';

export function ValueCell({ row }: { row: MedicalLabRow }) {
  const tone =
    row.flag && /high|above/i.test(row.flag)
      ? 'text-warning dark:text-warning'
      : row.flag && /low|below/i.test(row.flag)
        ? 'text-info dark:text-info'
        : 'text-text-primary';

  return (
    <span className={`font-black tabular-nums ${tone}`}>
      {row.value}
      {row.unit ? <span className="ml-0.5 text-xs font-semibold text-text-muted">{row.unit}</span> : null}
    </span>
  );
}
