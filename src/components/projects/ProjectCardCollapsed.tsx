/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlertTriangle, ChevronDown, ChevronUp, Check, ArrowRight, CalendarDays } from 'lucide-react';
import Badge from '../ui/Badge';
import type { ProjectCheckpoint } from '../../lib/projects/projects';
import type { GoalKpiRow, ProjectRow, ProjectStats } from './projectUtils';
import HealthScore from './HealthScore';
import { KpiTrendSparkline } from './KpiTrendSparkline';
import { useProjectsContext } from './context/projectsContextStore';

interface ProjectCardCollapsedProps {
  project: ProjectRow;
  s: ProjectStats;
  isExpanded: boolean;
  col: any;
  pm: any;
  momentumMeta: any;
  healthScore: number;
  kpis: GoalKpiRow[];
  visibleCps: ProjectCheckpoint[];
  doneCheckpoints: number;
  projectCheckpoints: ProjectCheckpoint[];
  nextAction: string | null;
}

interface KpiRowsProps {
  kpis: GoalKpiRow[];
  col: any;
  isExpanded: boolean;
}

function KpiRows({
  kpis,
  col,
  isExpanded,
}: KpiRowsProps) {
  const { editingKpiId, setEditingKpiId, handlers, userId } = useProjectsContext();

  return (
    <div className="mt-2.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      {kpis.map((kpi) => {
        const pct =
          kpi.target != null && kpi.current_value != null
            ? Math.min(
                100,
                Math.round((Number(kpi.current_value) / Number(kpi.target)) * 100)
              )
            : null;
        const isEditing = editingKpiId === kpi.id;
        return (
          <div key={kpi.id} className="space-y-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${col.dot}`} />
              <span className="text-[10px] text-text-muted truncate flex-1">{kpi.name}</span>
              {isEditing ? (
                <input
                  autoFocus
                  type="number"
                  defaultValue={kpi.current_value ?? ''}
                  onBlur={(e) => handlers.handleUpdateKpiValue(kpi.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlers.handleUpdateKpiValue(kpi.id, (e.target as HTMLInputElement).value);
                    }
                    if (e.key === 'Escape') setEditingKpiId(null);
                  }}
                  className="w-16 rounded-lg border border-primary/40 bg-background/80 px-2 py-0.5 text-[11px] font-bold text-primary outline-none text-center"
                />
              ) : (
                <button
                  onClick={() => setEditingKpiId(kpi.id)}
                  className={`text-[11px] font-black ${col.text} hover:underline cursor-pointer`}
                  title="Kliknij żeby edytować"
                >
                  {kpi.current_value != null ? kpi.current_value : '—'}
                  {kpi.unit ? ` ${kpi.unit}` : ''}
                  {kpi.target != null && (
                    <span className="font-normal text-text-muted/60"> / {kpi.target}</span>
                  )}
                </button>
              )}
              {pct !== null && !isEditing && (
                <span className="text-[9px] font-bold text-text-muted/60 shrink-0">{pct}%</span>
              )}
            </div>
            {isExpanded && (
              <KpiTrendSparkline
                kpiId={kpi.id}
                userId={userId}
                unit={kpi.unit}
                target={kpi.target}
                currentValue={kpi.current_value}
              />
            )}
            {pct !== null && (
              <div className="ml-3 h-1 w-full rounded-full bg-border-custom overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${col.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PILLAR_HEX_COLORS: Record<string, string> = {
  emerald: '#10b981',
  indigo: '#6366f1',
  amber: '#f59e0b',
};

export default function ProjectCardCollapsed({
  project, s, isExpanded, col, pm, momentumMeta, healthScore, kpis,
  visibleCps, doneCheckpoints, projectCheckpoints, nextAction
}: ProjectCardCollapsedProps) {
  const { setExpandedId } = useProjectsContext();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpandedId((p) => (p === project.id ? null : project.id));
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="w-full text-left px-4 pt-3.5 pb-3 cursor-pointer"
      onClick={() => setExpandedId((p) => (p === project.id ? null : project.id))}
      onKeyDown={onKeyDown}
    >
      {/* Top row: name + health score */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {pm && (
              <Badge
                variant="tag"
                color={PILLAR_HEX_COLORS[pm.color] || '#3b82f6'}
                className="gap-1 text-[9px] font-black uppercase tracking-widest"
              >
                <pm.icon size={9} />
                {pm.label}
              </Badge>
            )}
            {s.slipping && (
              <Badge variant="tag" color="#f59e0b">
                <AlertTriangle size={8} /> {s.daysSince}d temu
              </Badge>
            )}
            <Badge
              variant="tag"
              color={momentumMeta.color}
              className="text-[9px] font-bold"
            >
              {momentumMeta.label}
            </Badge>
          </div>

          {/* Project name */}
          <span className="text-[15px] font-bold text-text-primary leading-tight">
            {project.name}
          </span>

          {/* Goal / identity */}
          {project.goal && (
            <p className="mt-0.5 text-[11px] text-text-muted/70 line-clamp-1 italic">
              {project.goal}
            </p>
          )}
        </div>

        {/* Health score ring + chevron */}
        <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
          <HealthScore score={healthScore} size={40} />
          {isExpanded ? (
            <ChevronUp size={13} className="text-text-muted" />
          ) : (
            <ChevronDown size={13} className="text-text-muted" />
          )}
        </div>
      </div>

      {/* Progress bar (tasks) */}
      {s.total > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-text-muted">
              {s.doneItems.length}/{s.total} zadań
            </span>
            <span className={`text-[10px] font-bold ${col.text}`}>{s.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border-custom/40">
            <div
              className={`h-full rounded-full transition-all duration-700 ${col.bar}`}
              style={{ width: `${s.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* KPI mini-rows */}
      {kpis.length > 0 && (
        <KpiRows
          kpis={kpis}
          col={col}
          isExpanded={isExpanded}
        />
      )}

      {/* Checkpoint mini-timeline */}
      {visibleCps.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5">
          {visibleCps.map((cp, idx) => (
            <div key={cp.id} className="flex items-center gap-1">
              <div
                className={`h-2.5 w-2.5 rounded-full border-2 flex items-center justify-center transition-all ${
                  cp.status === 'done' ? `${col.dot} border-transparent` : 'border-border-custom bg-transparent'
                }`}
              >
                {cp.status === 'done' && <Check size={6} className="text-white" strokeWidth={3} />}
              </div>
              {idx < visibleCps.length - 1 && (
                <div className={`h-px w-3 ${cp.status === 'done' ? col.bar : 'bg-border-custom/40'}`} />
              )}
            </div>
          ))}
          <span className="ml-1.5 text-[10px] text-text-muted">
            {doneCheckpoints}/{projectCheckpoints.length}
          </span>
        </div>
      )}

      {/* Next Action hint */}
      {nextAction && !isExpanded && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <ArrowRight size={10} className={col.text} />
          <span className="text-[11px] text-text-muted truncate">{nextAction}</span>
        </div>
      )}

      {/* Deadline pill */}
      {s.daysLeft !== null && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              s.daysLeft < 0
                ? 'bg-rose-500/10 text-rose-500'
                : s.daysLeft <= 7
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-surface-solid text-text-muted'
            }`}
          >
            <CalendarDays size={10} />
            {s.daysLeft < 0 ? `${Math.abs(s.daysLeft)}d po terminie` : `${s.daysLeft}d do końca`}
          </span>
        </div>
      )}
    </div>
  );
}
