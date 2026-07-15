import { Pressable, ControlInput } from '../ui/ControlPrimitives';
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import {
  addProjectKpi,
  fetchProjectWeekKpis,
  setProjectKpiTarget,
} from '../../lib/goal/goalSpine';
import { PILLARS, PILLAR_META } from '../../lib/projects/pillars';
import { projectWeekKpisKeys } from '../../lib/queryKeys';

const PILLAR_OPTIONS = PILLARS.map((id) => ({ id, label: PILLAR_META[id].label }));

type ProjectLite = { id: string; name: string };



export default function ProjectWeekKpis({
  userId,
  projects,
  weekStart,
  readOnly = false,
  focusProjectIds = [],
}: {
  userId: string;
  projects: ProjectLite[];
  weekStart: string;
  readOnly?: boolean;
  focusProjectIds?: string[];
}) {
  const queryClient = useQueryClient();
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newKpi, setNewKpi] = useState({ name: '', unit: '', target: '', pillar: 'konto' as 'cialo' | 'duch' | 'konto' });

  const projectIds = projects.map((p) => p.id);
  const projectIdsKey = projectIds.slice().sort().join(',');

  const kpisQuery = useQuery({
    queryKey: projectWeekKpisKeys.list(userId, weekStart, projectIdsKey),
    queryFn: () => fetchProjectWeekKpis(userId, projectIds, weekStart),
    enabled: projectIds.length > 0,
  });

  const byProject = kpisQuery.data ?? {};
  const loaded = kpisQuery.isSuccess;

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: projectWeekKpisKeys.all });
  }, [queryClient]);

  async function saveTarget(kpiId: string, value: string) {
    const trimmed = value.trim();
    const target = trimmed === '' ? null : parseFloat(trimmed);
    if (trimmed !== '' && !Number.isFinite(target)) return;
    await setProjectKpiTarget(userId, kpiId, target);
    invalidate();
  }

  async function submitNewKpi(projectId: string) {
    if (!newKpi.name.trim()) return;
    await addProjectKpi(userId, projectId, newKpi.pillar, {
      name: newKpi.name,
      unit: newKpi.unit,
      target: newKpi.target.trim() === '' ? null : parseFloat(newKpi.target),
    });
    setAddingFor(null);
    setNewKpi({ name: '', unit: '', target: '', pillar: 'konto' });
    invalidate();
  }

  if (!loaded || projects.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[var(--ds-arbitrary-0-14em)] text-text-muted">
        <TrendingUp size={12} /> Projekty tego tygodnia ({projects.length})
      </p>
      <div className="space-y-2.5">
        {projects.map((project) => {
          const kpis = byProject[project.id] ?? [];
          return (
            <Card key={project.id} padding="0.75rem 0.875rem" className="space-y-2">
              <p className="text-sm font-bold text-text-primary flex items-center gap-2 flex-wrap">
                {project.name}
                {focusProjectIds.includes(project.id) && (
                  <span className="text-2xs font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    Focus sprintu
                  </span>
                )}
              </p>

              {kpis.map(({ kpi, thisWeekValue }) => {
                const pct = kpi.target ? Math.min(100, Math.round(((thisWeekValue ?? 0) / kpi.target) * 100)) : null;
                return (
                  <div key={kpi.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-text-secondary">{kpi.name}</span>
                      <span className="text-xs font-bold text-text-primary">
                        {thisWeekValue ?? 0}
                        {kpi.unit ? ` ${kpi.unit}` : ''} /{' '}
                        {readOnly ? (
                          <span>{kpi.target ?? '—'}</span>
                        ) : (
                          <ControlInput
                            type="number"
                            inputMode="decimal"
                            defaultValue={kpi.target ?? ''}
                            placeholder="cel?"
                            onBlur={(e) => saveTarget(kpi.id, e.target.value)}
                            className="w-14 rounded-md border border-border-custom bg-surface-solid px-1.5 py-0.5 text-xs font-bold text-text-primary outline-none focus:border-primary/40"
                          />
                        )}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="h-1 w-full overflow-hidden rounded-full bg-border-custom/40">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}

              {kpis.length === 0 && !readOnly && addingFor !== project.id && (
                <Pressable
                  type="button"
                  onClick={() => setAddingFor(project.id)}
                  variant="ghost"
                  size="sm"
                  icon={<Plus size={11} />}
                  className="!px-0 text-primary"
                >
                  ustal liczbę
                </Pressable>
              )}

              {addingFor === project.id && !readOnly && (
                <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/[0.03] p-2.5">
                  <ControlInput
                    autoFocus
                    value={newKpi.name}
                    onChange={(e) => setNewKpi((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nazwa (np. diale, nowi klienci)"
                    className="w-full bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                  />
                  <div className="flex items-center gap-1.5">
                    <ControlInput
                      value={newKpi.unit}
                      onChange={(e) => setNewKpi((f) => ({ ...f, unit: e.target.value }))}
                      placeholder="jednostka"
                      className="min-w-0 flex-1 bg-transparent text-xs text-text-secondary outline-none placeholder:text-text-muted/40 border-b border-border-custom/50 pb-0.5"
                    />
                    <ControlInput
                      type="number"
                      inputMode="decimal"
                      value={newKpi.target}
                      onChange={(e) => setNewKpi((f) => ({ ...f, target: e.target.value }))}
                      placeholder="cel"
                      className="w-16 bg-transparent text-xs text-text-secondary outline-none placeholder:text-text-muted/40 border-b border-border-custom/50 pb-0.5"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {PILLAR_OPTIONS.map((p) => (
                      <Pressable
                        key={p.id}
                        type="button"
                        onClick={() => setNewKpi((f) => ({ ...f, pillar: p.id }))}
                        className={`rounded-md px-2 py-0.5 text-2xs font-black uppercase cursor-pointer transition-colors ${
                          newKpi.pillar === p.id ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {p.label}
                      </Pressable>
                    ))}
                  </div>
                  <div className="flex gap-1.5 pt-0.5">
                    <Pressable
                      type="button"
                      onClick={() => setAddingFor(null)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Anuluj
                    </Pressable>
                    <Pressable
                      type="button"
                      onClick={() => submitNewKpi(project.id)}
                      disabled={!newKpi.name.trim()}
                      variant="primary"
                      size="sm"
                      icon={<Check size={10} />}
                      className="flex-1"
                    >
                      Dodaj
                    </Pressable>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
