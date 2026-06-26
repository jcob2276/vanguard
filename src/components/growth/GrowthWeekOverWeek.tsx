import type { GrowthPrevWeekSummary } from '../../lib/growthWeek';
import { formatShortWeek } from '../../lib/growthWeek';

export default function GrowthWeekOverWeek({
  prev,
  currentFocusLabel,
  currentFocusTarget,
  currentFocusScore,
  mustDone,
  mustTotal,
}: {
  prev: GrowthPrevWeekSummary | null;
  currentFocusLabel: string | null;
  currentFocusTarget: number | null;
  currentFocusScore: number | null;
  mustDone: number;
  mustTotal: number;
}) {
  if (!prev && mustTotal === 0 && !currentFocusLabel) return null;

  const scoreDelta =
    currentFocusScore != null && prev?.focusScore != null ? currentFocusScore - prev.focusScore : null;
  const mustDelta = prev ? mustDone - prev.mustDone : null;

  return (
    <section className="rounded-xl border border-border-custom bg-surface/30 px-3 py-3 space-y-2">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">vs poprzedni tydzień</p>

      {!prev ? (
        <p className="text-[11px] text-text-muted">Pierwszy tydzień z danymi — brak porównania.</p>
      ) : (
        <ul className="space-y-1.5 text-[11px]">
          <li className="flex justify-between gap-2">
            <span className="text-text-muted shrink-0">{formatShortWeek(prev.weekStart)}</span>
            <span className="font-semibold text-text-secondary text-right truncate">
              {prev.focusLabel ?? '—'}
              {prev.focusScore != null && prev.focusTarget != null && (
                <span className="text-text-muted"> ({prev.focusScore}→{prev.focusTarget})</span>
              )}
            </span>
          </li>
          <li className="flex justify-between gap-2 border-t border-border-custom/60 pt-1.5">
            <span className="text-text-muted">Focus</span>
            <span className="font-bold text-text-primary text-right truncate">
              {currentFocusLabel ?? '—'}
              {currentFocusScore != null && currentFocusTarget != null && (
                <span className="text-primary"> {currentFocusScore}→{currentFocusTarget}</span>
              )}
              {scoreDelta != null && scoreDelta !== 0 && (
                <span className={scoreDelta > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {' '}
                  ({scoreDelta > 0 ? '+' : ''}
                  {scoreDelta})
                </span>
              )}
            </span>
          </li>
          {(prev.mustTotal > 0 || mustTotal > 0) && (
            <li className="flex justify-between gap-2">
              <span className="text-text-muted">MUST</span>
              <span className="font-bold tabular-nums">
                {prev.mustDone}/{prev.mustTotal} → {mustDone}/{mustTotal}
                {mustDelta != null && mustDelta !== 0 && (
                  <span className={mustDelta > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {' '}
                    ({mustDelta > 0 ? '+' : ''}
                    {mustDelta})
                  </span>
                )}
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
