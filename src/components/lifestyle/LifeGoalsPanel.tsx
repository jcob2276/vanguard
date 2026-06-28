import {
  daysBadgeClass,
  formatDaysLabel,
  type LifeGoalDisplayRow,
} from '../../lib/lifeGoals';

type LifeGoalsPanelProps = {
  rows: LifeGoalDisplayRow[];
  compact?: boolean;
  emptyHint?: string;
  fromProjects?: boolean;
};

export default function LifeGoalsPanel({ rows, compact = false, emptyHint, fromProjects }: LifeGoalsPanelProps) {
  if (!rows.length) {
    if (!emptyHint) return null;
    return (
      <div className="rounded-xl border border-dashed border-border-custom bg-surface/40 px-3 py-2.5">
        <p className="text-[8px] font-black uppercase tracking-widest text-text-muted">Twoje cele</p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary">{emptyHint}</p>
      </div>
    );
  }

  const titleClass = compact ? 'text-[8px]' : 'text-[8px]';
  const bodyClass = compact ? 'text-[11px]' : 'text-[11px]';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className={`${titleClass} font-black uppercase tracking-widest text-text-muted`}>Twoje cele</p>
        {fromProjects && (
          <span className="text-[7px] font-bold uppercase tracking-widest text-text-muted/70">z projektów</span>
        )}
      </div>
      <div className="space-y-2">
        {rows.map(({ id, label, icon: Icon, card, text, badge, title, subtitle, days, projectId, kpis }) => (
          <div key={`${id}-${projectId ?? 'life'}`} className={`rounded-xl border px-3 py-2.5 ${card}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={11} className={text} />
              <span className={`text-[8px] font-black uppercase tracking-widest ${text}`}>{label}</span>
              <div className="flex-1" />
              {formatDaysLabel(days) && (
                <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${daysBadgeClass(days, badge)}`}>
                  {formatDaysLabel(days)}
                </span>
              )}
            </div>
            <p className={`${bodyClass} font-semibold text-text-primary leading-snug`}>{title}</p>
            {subtitle && (
              <p className="mt-0.5 text-[10px] font-medium text-text-muted leading-snug">{subtitle}</p>
            )}
            {kpis && kpis.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-border-custom/20 pt-2">
                {kpis.map((k) => (
                  <div key={k.id} className="flex items-center justify-between text-[10px] font-medium text-text-secondary leading-tight">
                    <span className="truncate pr-2">↳ {k.name}</span>
                    <span className="font-bold tabular-nums text-text-primary shrink-0">
                      {k.current !== null ? k.current : '—'}
                      {k.target !== null ? ` / ${k.target}` : ''}
                      {k.unit ? ` ${k.unit}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
