import Spinner from '../../ui/Spinner';
import { Card } from '../../ui/Card';
import ProjectWeekKpis from '../ProjectWeekKpis';

type Phase1Recap = { narrative: string; longterm_motif: string | null; question: string };
type WeekFacts = {
  doneCount: number;
  totalCount: number;
  doneTasks: string[];
  droppedTasks: string[];
  sleepHrs: number | null;
  readiness: number | null;
  totalKm: number | null;
  avgKcal: number | null;
  targetKcal: number | null;
};

function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-border-custom" />
      <span className="text-[9px] uppercase tracking-widest text-text-muted font-black">{title}</span>
      <div className="h-px flex-1 bg-border-custom" />
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <Card padding="0.625rem 0.75rem">
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-[10px] text-text-muted mt-0.5">{label}</div>
    </Card>
  );
}

export function Block1Narrative({ phase1, phase1Loading }: { phase1: Phase1Recap | null; phase1Loading: boolean }) {
  return (
    <div className="space-y-3">
      <Divider title="Jak wyglądał twój tydzień" />
      {phase1Loading && (
        <div className="flex items-center gap-2 py-3 text-text-muted text-sm">
          <Spinner size="sm" />
          AI analizuje tydzień…
        </div>
      )}
      {phase1 && (
        <div className="space-y-3">
          <p className="text-sm text-text-primary leading-relaxed">{phase1.narrative}</p>
          {phase1.longterm_motif && (
            <div className="border-l-2 border-warning pl-3 py-1">
              <p className="text-[10px] text-warning font-bold uppercase tracking-wider mb-1">Długoterminowy motyw</p>
              <p className="text-sm text-text-primary leading-relaxed">{phase1.longterm_motif}</p>
            </div>
          )}
          {phase1.question && (
            <div className="bg-surface border border-border-custom rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Pytanie otwierające</p>
              <p className="text-sm text-text-secondary italic">„{phase1.question}"</p>
            </div>
          )}
        </div>
      )}
      {!phase1Loading && !phase1 && (
        <p className="text-sm text-text-muted italic">AI podsumowanie pojawi się za chwilę…</p>
      )}
    </div>
  );
}

export function Block2WeekStats({
  weekFacts, activeProjects, userId, weekStart, sprintFocusProjectIds,
}: {
  weekFacts: WeekFacts;
  activeProjects: { id: string; name: string }[];
  userId: string;
  weekStart: string;
  sprintFocusProjectIds?: string[];
}) {
  return (
    <div className="space-y-4">
      <Divider title="Tydzień w liczbach" />
      {activeProjects.length > 0 && (
        <div className="border border-border-custom bg-surface/30 rounded-xl p-3.5 space-y-2">
          <ProjectWeekKpis userId={userId} projects={activeProjects} weekStart={weekStart} focusProjectIds={sprintFocusProjectIds ?? []} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <StatCard value={String(weekFacts.doneCount)} label="zadań zrobionych" />
        <StatCard value={String(weekFacts.totalCount - weekFacts.doneCount)} label="niezrobionych" />
        {weekFacts.sleepHrs != null && <StatCard value={weekFacts.sleepHrs.toFixed(1) + "h"} label="śr. sen" />}
        {weekFacts.readiness != null && <StatCard value={Math.round(weekFacts.readiness).toString()} label="śr. readiness" />}
        {weekFacts.totalKm != null && weekFacts.totalKm > 0 && <StatCard value={weekFacts.totalKm.toFixed(0) + "km"} label="łącznie (Strava)" />}
        {weekFacts.avgKcal != null && <StatCard value={Math.round(weekFacts.avgKcal).toString()} label={`śr. kcal${weekFacts.targetKcal ? ` / cel ${weekFacts.targetKcal}` : ""}`} />}
      </div>
      {weekFacts.doneTasks.length > 0 && (
        <div className="space-y-1 mt-1">
          {weekFacts.doneTasks.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
              <span className="text-success mt-0.5 shrink-0">✓</span><span>{t}</span>
            </div>
          ))}
          {weekFacts.droppedTasks.map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-text-muted">
              <span className="text-danger mt-0.5 shrink-0">↯</span><span>{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
