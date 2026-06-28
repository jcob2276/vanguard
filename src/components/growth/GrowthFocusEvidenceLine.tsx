import type { GrowthContextData } from '../../hooks/useGrowthData';

export default function GrowthFocusEvidenceLine({
  skillLabel,
  declaredLevel,
  targetLevel,
  focusMustDone,
  focusMustTotal,
  repDone,
  repTarget,
  notesCount,
  context,
}: {
  skillLabel: string;
  declaredLevel: number | null;
  targetLevel: number | null;
  focusMustDone: number;
  focusMustTotal: number;
  repDone: number;
  repTarget: number | null;
  notesCount: number;
  context: GrowthContextData;
}) {
  const parts: string[] = [];

  if (declaredLevel != null && targetLevel != null) {
    parts.push(`Deklaracja ${declaredLevel}→${targetLevel}`);
  }

  if (context.kpiName && context.kpiValue != null) {
    const kpi =
      context.kpiTarget != null
        ? `${context.kpiName} ${context.kpiValue}/${context.kpiTarget}`
        : `${context.kpiName} ${context.kpiValue}`;
    parts.push(`KPI ${kpi}`);
  }

  if (focusMustTotal > 0) {
    parts.push(`MUST ${focusMustDone}/${focusMustTotal}`);
  }

  if (repTarget != null && repTarget > 0) {
    parts.push(`praktyka ${repDone}/${repTarget}`);
  }

  if (notesCount > 0) {
    parts.push(`${notesCount} ${notesCount === 1 ? 'notatka' : 'notatki'}`);
  }

  if (parts.length === 0) {
    return (
      <p className="text-[10px] text-text-muted rounded-lg border border-dashed border-border-custom px-3 py-2">
        {skillLabel}: ustaw MUST i KPI w projekcie, żeby zobaczyć dowody obok deklaracji.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border-custom bg-surface/40 px-3 py-2">
      <p className="text-[8px] font-black uppercase tracking-wider text-text-muted mb-1">
        {skillLabel} · dowód vs deklaracja
      </p>
      <p className="text-[11px] font-semibold text-text-secondary leading-relaxed">
        {parts.join(' · ')}
      </p>
    </div>
  );
}
