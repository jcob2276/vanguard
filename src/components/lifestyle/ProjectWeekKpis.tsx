import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, TrendingUp } from 'lucide-react';
import {
  addProjectKpi,
  fetchProjectWeekKpis,
  setProjectKpiTarget,
  type ProjectWeekKpi,
} from '../../lib/goal/goalSpine';
import { PILLARS, PILLAR_META } from '../../lib/projects/pillars';

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
  const [byProject, setByProject] = useState<Record<string, ProjectWeekKpi[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newKpi, setNewKpi] = useState({ name: '', unit: '', target: '', pillar: 'konto' as 'cialo' | 'duch' | 'konto' });

  const projectIds = projects.map((p) => p.id);
  const projectIdsKey = projectIds.slice().sort().join(',');

  const reload = useCallback(async () => {
    if (projectIds.length === 0) {
      setByProject({});
      setLoaded(true);
      return;
    }
    try {
      setByProject(await fetchProjectWeekKpis(userId, projectIds, weekStart));
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, weekStart, projectIdsKey]);

  useEffect(() => {
    void (async () => { await reload(); })();
  }, [reload]);

  async function saveTarget(kpiId: string, value: string) {
    const trimmed = value.trim();
    const target = trimmed === '' ? null : parseFloat(trimmed);
    if (trimmed !== '' && !Number.isFinite(target)) return;
    await setProjectKpiTarget(userId, kpiId, target);
    void reload();
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
    void reload();
  }

  if (!loaded || projects.length === 0) return null;

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-text-muted">
        <TrendingUp size={12} /> Projekty tego tygodnia ({projects.length})
      </p>
      <div className="space-y-2.5">
        {projects.map((project) => {
          const kpis = byProject[project.id] ?? [];
          return (
            <div key={project.id} className="rounded-xl border border-border-custom bg-surface px-3.5 py-3 space-y-2">
              <p className="text-[13px] font-bold text-text-primary flex items-center gap-2 flex-wrap">
                {project.name}
                {focusProjectIds.includes(project.id) && (
                  <span className="text-[8px] font-black uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    Focus sprintu
                  </span>
                )}
              </p>

              {kpis.map(({ kpi, thisWeekValue }) => {
                const pct = kpi.target ? Math.min(100, Math.round(((thisWeekValue ?? 0) / kpi.target) * 100)) : null;
                return (
                  <div key={kpi.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-text-secondary">{kpi.name}</span>
                      <span className="text-[11px] font-bold text-text-primary">
                        {thisWeekValue ?? 0}
                        {kpi.unit ? ` ${kpi.unit}` : ''} /{' '}
                        {readOnly ? (
                          <span>{kpi.target ?? '—'}</span>
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            defaultValue={kpi.target ?? ''}
                            placeholder="cel?"
                            onBlur={(e) => saveTarget(kpi.id, e.target.value)}
                            className="w-14 rounded-md border border-border-custom bg-surface-solid px-1.5 py-0.5 text-[11px] font-bold text-text-primary outline-none focus:border-primary/40"
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
                <button
                  type="button"
                  onClick={() => setAddingFor(project.id)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary cursor-pointer"
                >
                  <Plus size={11} /> ustal liczbę
                </button>
              )}

              {addingFor === project.id && !readOnly && (
                <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/[0.03] p-2.5">
                  <input
                    autoFocus
                    value={newKpi.name}
                    onChange={(e) => setNewKpi((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nazwa (np. diale, nowi klienci)"
                    className="w-full bg-transparent text-[12px] font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      value={newKpi.unit}
                      onChange={(e) => setNewKpi((f) => ({ ...f, unit: e.target.value }))}
                      placeholder="jednostka"
                      className="min-w-0 flex-1 bg-transparent text-[11px] text-text-secondary outline-none placeholder:text-text-muted/40 border-b border-border-custom/50 pb-0.5"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={newKpi.target}
                      onChange={(e) => setNewKpi((f) => ({ ...f, target: e.target.value }))}
                      placeholder="cel"
                      className="w-16 bg-transparent text-[11px] text-text-secondary outline-none placeholder:text-text-muted/40 border-b border-border-custom/50 pb-0.5"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {PILLAR_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNewKpi((f) => ({ ...f, pillar: p.id }))}
                        className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase cursor-pointer transition-colors ${
                          newKpi.pillar === p.id ? 'bg-primary/15 text-primary' : 'text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setAddingFor(null)}
                      className="flex-1 rounded-lg border border-border-custom py-1.5 text-[10px] font-bold text-text-muted cursor-pointer"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={() => submitNewKpi(project.id)}
                      disabled={!newKpi.name.trim()}
                      className="flex-1 rounded-lg bg-primary py-1.5 text-[10px] font-bold text-white disabled:opacity-30 cursor-pointer"
                    >
                      <Check size={10} className="inline mr-1" /> Dodaj
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
