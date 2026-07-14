import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Target } from 'lucide-react';
import type { GrowthProjectSummary } from './hooks/useGrowthData';
import type { LearningWeekPin } from '../../lib/growth/growth';
import { KpiTrendSparkline } from '../projects/KpiTrendSparkline';
import Button from '../ui/Button';
import { Card } from '../ui/Card';

export default function GrowthProjectsPanel({
  projects,
  pins,
  userId,
  sprintGoal,
  sprintLabel,
  focusProjectId,
  onAddMust,
  onKpiChange,
}: {
  projects: GrowthProjectSummary[];
  pins: LearningWeekPin[];
  userId: string;
  sprintGoal: string | null;
  sprintLabel: string | null;
  focusProjectId?: string | null;
  onAddMust?: (projectId: string) => void;
  onKpiChange?: () => void;
}) {
  if (projects.length === 0 && !sprintGoal) {
    return (
      <section className="rounded-2xl border border-dashed border-border-custom p-4 space-y-2">
        <p className="text-2xs font-black uppercase tracking-wider text-text-muted">Projekty</p>
        <p className="text-sm text-text-muted leading-relaxed">
          Brak aktywnego projektu. Skilli bez projektu = deklaracja bez dowodu.
        </p>
        <Link
          to="/projekty"
          className="inline-block text-xs font-black uppercase text-primary hover:underline"
        >
          Otwórz Projekty -&gt;
        </Link>
      </section>
    );
  }

  return (
    <Card variant="glass" padding="1rem" className="space-y-3 h-full">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-wider text-text-muted">
          <FolderKanban size={12} /> Projekty &middot; dow&oacute;d
        </p>
        <Link
          to="/projekty"
          className="text-2xs font-black uppercase text-primary hover:underline shrink-0"
        >
          Wszystkie -&gt;
        </Link>
      </div>

      {sprintGoal && (
        <div className="rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2">
          <p className="text-2xs font-black uppercase text-primary">{sprintLabel ?? 'Sprint'}</p>
          <p className="text-xs font-semibold text-text-primary mt-0.5 line-clamp-2">{sprintGoal}</p>
        </div>
      )}

      <div className="space-y-2">
        {projects.map((p) => {
          const projectPins = pins.filter((pin) => pin.project_id === p.id);
          const allRelevantPins = p.id === focusProjectId
            ? pins.filter((pin) => pin.project_id === p.id || pin.project_id == null)
            : projectPins;
          const mustCount = allRelevantPins.filter((pin) => pin.slot === 'must').length;
          const doneCount = allRelevantPins.filter((pin) => pin.done).length;
          const totalCount = allRelevantPins.length;
          const isFocus = p.id === focusProjectId;
          const primaryKpi = p.kpis[0] ?? null;
          const kpiPct = primaryKpi?.target && primaryKpi.current != null
            ? Math.min(100, Math.round((primaryKpi.current / primaryKpi.target) * 100))
            : null;

          return (
            <div
              key={p.id}
              className={`rounded-xl border px-3 py-2.5 ${isFocus ? 'border-primary/30 bg-primary/[0.03]' : 'border-border-custom bg-background/40'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isFocus && <Target size={11} className="text-primary shrink-0" />}
                    <p className="text-sm font-bold text-text-primary truncate">{p.name}</p>
                  </div>
                  {p.goal && (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{p.goal}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {totalCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-2xs font-black text-primary">
                      {doneCount}/{totalCount}{mustCount > 0 ? ` · ${mustCount} MUST` : ''}
                    </span>
                  ) : (
                    <span className="text-2xs font-bold text-text-muted">brak planu tygodnia</span>
                  )}
                  {onAddMust && (
                    <Button
                      variant="tonal"
                      size="sm"
                      onClick={() => onAddMust(p.id)}
                      className="p-1 rounded-lg bg-danger/10 text-danger dark:text-danger hover:bg-danger/20"
                      title="Dodaj MUST"
                      icon={<Plus size={12} />}
                    />
                  )}
                </div>
              </div>

              {p.kpis.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {p.kpis.map((k) => (
                    <div key={k.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-text-secondary truncate">{k.name}</span>
                          {k.current != null && (
                            <span className="text-xs font-black text-primary tabular-nums shrink-0">
                              {k.current}{k.target != null ? `/${k.target}` : ''}
                            </span>
                          )}
                        </div>
                        {kpiPct != null && k.id === primaryKpi?.id && (
                          <div className="mt-1 h-1 rounded-full bg-border-custom overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${kpiPct}%` }} />
                          </div>
                        )}
                      </div>
                      <KpiTrendSparkline
                        kpiId={k.id}
                        userId={userId}
                        target={k.target}
                        currentValue={k.current}
                        unit={undefined}
                        compact
                        onValueChange={() => onKpiChange?.()}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-warning dark:text-warning mt-1.5">Brak KPI</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
