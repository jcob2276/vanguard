import { Zap } from 'lucide-react';
import { calculateHealthScore, getHealthLevel, HEALTH_COLORS, ProjectStats, ProjectRow, GoalKpiRow } from './projectUtils';

interface Props {
  focusProject: ProjectRow | null;
  activeFilteredFirst: ProjectRow | undefined;
  stats: Record<string, ProjectStats>;
  kpisByProject: Record<string, GoalKpiRow[]>;
  onOpen: (id: string) => void;
}

const EMPTY_STATS: ProjectStats = {
  section: null, openItems: [], doneItems: [], total: 0, progress: 0,
  lastActivity: null, daysSince: null, slipping: false, daysLeft: null,
};

export function FocusProjectBanner({ focusProject, activeFilteredFirst, stats, kpisByProject, onOpen }: Props) {
  if (!focusProject || activeFilteredFirst?.id === focusProject.id) return null;

  const s = stats[focusProject.id] ?? EMPTY_STATS;
  const kpis = kpisByProject[focusProject.id] ?? [];
  const score = calculateHealthScore(focusProject, s, kpis);
  const level = getHealthLevel(score);
  const hc = HEALTH_COLORS[level];

  return (
    <div className={`rounded-[20px] border p-4 ${hc.bg} ${
      level === 'critical' ? 'border-rose-500/30' : 'border-amber-500/25'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Zap size={12} className={hc.text} />
        <p className={`text-[9px] font-black uppercase tracking-widest ${hc.text}`}>
          Wymaga uwagi · Health {score}
        </p>
      </div>
      <p className="text-[14px] font-bold text-text-primary">{focusProject.name}</p>
      {focusProject.goal && (
        <p className="text-[11px] text-text-muted mt-0.5 italic line-clamp-1">{focusProject.goal}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onOpen(focusProject.id)}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${hc.bg} ${hc.text} border ${
            level === 'critical' ? 'border-rose-500/30' : 'border-amber-500/25'
          }`}
        >
          Otwórz projekt
        </button>
        {s.openItems?.[0] && (
          <p className="text-[11px] text-text-muted truncate">→ {s.openItems[0].title}</p>
        )}
      </div>
    </div>
  );
}
