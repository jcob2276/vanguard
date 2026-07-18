import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Gauge, Plus, Target } from 'lucide-react';
import { getTodayWarsaw } from '../../lib/date';
import { addProjectActionToTopFive } from '../../lib/dailyTopFive';
import { notify } from '../../lib/notify';
import { PILLARS, PILLAR_META, type PillarId } from '../../lib/projects/pillars';
import { Pressable } from '../ui/ControlPrimitives';
import { useDashboardContext } from '../core/context/DashboardContext';
import { useProjectsContext } from './context/projectsContextStore';
import type { ProjectRow } from './projectUtils';

const GOAL_KEYS = {
  cialo: { goal: 'goal_cialo', date: 'date_cialo' },
  duch: { goal: 'goal_duch', date: 'date_duch' },
  konto: { goal: 'goal_konto', date: 'date_konto' },
} as const;

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const today = new Date(`${getTodayWarsaw()}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function ProjectRowView({ project, pillar }: { project: ProjectRow; pillar: PillarId }) {
  const { stats, userId } = useProjectsContext();
  const dashboard = useDashboardContext();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const action = stats[project.id]?.openItems[0] ?? null;
  const remaining = daysUntil(project.deadline);
  const projectStats = stats[project.id];

  async function addToToday() {
    if (!action || adding) return;
    setAdding(true);
    try {
      const result = await addProjectActionToTopFive(
        userId,
        getTodayWarsaw(),
        action.title,
        project.id,
        pillar,
      );
      setAdded(true);
      await dashboard.refresh();
      notify(result === 'draft' ? 'Dodano do szkicu Top 5.' : 'Dodano do dzisiejszego Top 5.', 'success');
      dashboard.navigateTo('dzis');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Nie udało się dodać działania.', 'error');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border-custom/60 bg-background/45 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">{project.name}</p>
          {project.goal && <p className="mt-0.5 text-sm text-text-muted line-clamp-2">{project.goal}</p>}
        </div>
        {remaining !== null && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-text-muted">
            <CalendarDays size={11} /> {remaining >= 0 ? `${remaining} dni` : `${Math.abs(remaining)} dni po`}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border-custom/40 pt-3">
        <ArrowRight size={13} className={PILLAR_META[pillar].text} />
        <p className="min-w-0 flex-1 truncate text-sm text-text-secondary">
          {action?.title ?? 'Brak następnego działania'}
        </p>
        {action && (
          <Pressable
            onClick={() => void addToToday()}
            disabled={adding || added}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${PILLAR_META[pillar].bg} ${PILLAR_META[pillar].text}`}
          >
            {added ? <Check size={12} /> : <Plus size={12} />}
            {added ? 'Dodano' : 'Top 5'}
          </Pressable>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs font-semibold text-text-muted">
        <span className="flex items-center gap-1"><Gauge size={10} /> Koszt zobowiązania</span>
        <span>{projectStats?.openItems.length ?? 0} otwartych działań</span>
        <span>{projectStats?.daysSince == null ? 'brak historii ruchu' : `${projectStats.daysSince} dni od ruchu`}</span>
      </div>
    </div>
  );
}

function PillarSection({ pillar }: { pillar: PillarId }) {
  const { activeProjects, projectPillar, lifeGoals } = useProjectsContext();
  const meta = PILLAR_META[pillar];
  const Icon = meta.icon;
  const keys = GOAL_KEYS[pillar];
  const direction = lifeGoals?.[keys.goal] ?? null;
  const targetDays = daysUntil(lifeGoals?.[keys.date]);
  const projects = activeProjects
    .filter((project) => projectPillar(project) === pillar)
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  const visibleProjects = projects.slice(0, 2);

  return (
    <section className={`rounded-3xl border ${meta.border} bg-surface/70 p-4`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.text}`}>
          <Icon size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className={`text-xs font-black uppercase tracking-widest ${meta.text}`}>{meta.label}</h3>
            {targetDays !== null && <span className="text-xs font-semibold text-text-muted">{targetDays} dni do celu</span>}
          </div>
          <p className="mt-1 text-base font-semibold leading-snug text-text-primary">
            {direction || 'Ustal kierunek dla tej sfery'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {visibleProjects.map((project) => <ProjectRowView key={project.id} project={project} pillar={pillar} />)}
        {visibleProjects.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border-custom px-4 py-5 text-center text-sm text-text-muted">
            Brak aktywnego projektu
          </p>
        )}
      </div>
      {projects.length > 2 && (
        <p className="mt-2 text-center text-xs text-warning">{projects.length - 2} projekt(y) poza limitem — wstrzymaj je, żeby odzyskać fokus.</p>
      )}
    </section>
  );
}

export function DirectionView() {
  const { activeProjects, stats } = useProjectsContext();
  const nearest = useMemo(() => activeProjects
    .filter((project) => project.deadline && daysUntil(project.deadline)! >= 0)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0] ?? null, [activeProjects]);
  const commitment = useMemo(() => activeProjects.reduce((acc, project) => {
    const projectStats = stats[project.id];
    acc.openActions += projectStats?.openItems.length ?? 0;
    if (projectStats?.slipping) acc.slipping += 1;
    return acc;
  }, { openActions: 0, slipping: 0 }), [activeProjects, stats]);

  return (
    <div className="space-y-4 p-5 pb-8">
      <header>
        <div className="flex items-center gap-2 text-primary">
          <Target size={17} />
          <h2 className="text-xl font-bold tracking-tight">Kierunek</h2>
        </div>
        <p className="mt-1 text-sm text-text-muted">Wybieram: kierunek → projekt → następne działanie → ręczne Top 5.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-border-custom/50 bg-surface/60 p-3">
          <Summary label="Aktywne" value={`${activeProjects.length}`} />
          <Summary label="Otwarte ruchy" value={`${commitment.openActions}`} />
          <Summary label="Bez tempa" value={`${commitment.slipping}`} warning={commitment.slipping > 0} />
        </div>
        {nearest && (
          <div className="mt-3 rounded-2xl border border-primary/15 bg-primary/[0.06] px-4 py-3">
            <p className="text-2xs font-black uppercase tracking-widest text-primary">Najbliższy główny cel</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate font-semibold text-text-primary">{nearest.goal || nearest.name}</p>
              <span className="shrink-0 text-sm font-bold text-primary">{daysUntil(nearest.deadline)} dni</span>
            </div>
          </div>
        )}
      </header>

      {PILLARS.map((pillar) => <PillarSection key={pillar} pillar={pillar} />)}
    </div>
  );
}

function Summary({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-2xs font-bold uppercase tracking-wider text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-black ${warning ? 'text-warning' : 'text-text-primary'}`}>{value}</p>
    </div>
  );
}
