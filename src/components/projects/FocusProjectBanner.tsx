import { Zap } from 'lucide-react';
import Button from '../ui/Button';
import { Card } from '../ui/Card';
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
    <Card variant="outline" padding="1rem" className={hc.bg} style={{ borderColor: level === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)' }}>
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
        <Button
          variant="tonal"
          size="sm"
          onClick={() => onOpen(focusProject.id)}
          className={`text-[11px] px-3 py-1.5 rounded-full ${hc.text} ${
            level === 'critical' ? 'border-danger/30' : 'border-warning/25'
          }`}
        >
          Otwórz projekt
        </Button>
        {s.openItems?.[0] && (
          <p className="text-[11px] text-text-muted truncate">→ {s.openItems[0].title}</p>
        )}
      </div>
    </Card>
  );
}
