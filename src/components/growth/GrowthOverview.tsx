import { Link } from 'react-router-dom';
import { ArrowRight, Compass, FolderKanban, ListChecks, Target, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GrowthContextData, GrowthLinkRow } from '../../hooks/useGrowthData';
import type { GrowthPrevWeekSummary, PowerListWeekStats } from '../../lib/growthWeek';
import type { FocusProposal } from '../../lib/growthOverview';
import { computeTheoryPracticeBalance } from '../../lib/growthMastery';
import type { LearningWeekPin } from '../../lib/growth';

const PILLAR = [
  { key: 'cialo' as const, label: 'Ciało' },
  { key: 'duch' as const, label: 'Duch' },
  { key: 'konto' as const, label: 'Konto' },
];

export default function GrowthOverview({
  context,
  powerListStats,
  focusProposal,
  pins,
  linksById,
  prevWeek,
  mustDone,
  mustTotal,
  weekFocusScore,
  focusTarget,
  readOnly,
}: {
  context: GrowthContextData;
  powerListStats: PowerListWeekStats;
  focusProposal: FocusProposal | null;
  pins: LearningWeekPin[];
  linksById: Map<string, GrowthLinkRow>;
  prevWeek: GrowthPrevWeekSummary | null;
  mustDone: number;
  mustTotal: number;
  weekFocusScore: number | null;
  focusTarget: number | null;
  readOnly: boolean;
}) {
  const { weekGoals } = context;
  const hasDirection =
    weekGoals.intention ||
    weekGoals.cialo ||
    weekGoals.duch ||
    weekGoals.konto ||
    weekGoals.commitment;

  const balance = computeTheoryPracticeBalance(pins, linksById);

  return (
    <section className="rounded-2xl border border-border-custom bg-surface/30 p-5 space-y-4">
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-text-muted">
          Lot ptaka · tydzień
        </p>
        <p className="text-[13px] font-semibold text-text-primary mt-1">
          Co · jak · dowód — bez konfiguracji tutaj
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          icon={<Compass size={12} />}
          label="Direction"
          value={
            hasDirection
              ? weekGoals.intention?.slice(0, 48) || 'Cele ustawione'
              : 'Brak celów'
          }
          muted={!hasDirection}
        />
        <Metric
          icon={<Target size={12} />}
          label={context.sprintLabel ?? 'Sprint'}
          value={context.sprintGoal?.slice(0, 48) || '—'}
          muted={!context.sprintGoal}
        />
        <Metric
          icon={<ListChecks size={12} />}
          label="PowerList"
          value={`${powerListStats.tasksDone}/${powerListStats.tasksSet || '—'} · ${powerListStats.daysWithWins}d`}
        />
        <Metric
          icon={<TrendingUp size={12} />}
          label="KPI projektu"
          value={
            context.kpiName && context.kpiValue != null
              ? `${context.kpiName} ${context.kpiValue}${context.kpiTarget != null ? `/${context.kpiTarget}` : ''}`
              : context.activeProjectName ?? 'Brak KPI'
          }
          muted={!context.kpiName}
        />
      </div>

      {focusProposal && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3">
          <p className="text-[9px] font-black uppercase text-primary tracking-wider">
            Focus {focusProposal.source === 'saved' ? 'tygodnia' : '(propozycja)'}
          </p>
          <p className="text-[15px] font-black text-text-primary mt-1">
            {focusProposal.parentLabel}
            {focusProposal.subskillLabel && (
              <span className="text-text-secondary font-bold"> → {focusProposal.subskillLabel}</span>
            )}
            <span className="text-primary ml-2 tabular-nums">
              {weekFocusScore ?? focusProposal.score}
              {focusTarget != null ? `→${focusTarget}` : ''}/5
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted">
        {mustTotal > 0 && (
          <span>
            MUST <span className="font-bold text-text-secondary">{mustDone}/{mustTotal}</span>
          </span>
        )}
        {balance.total > 0 && (
          <span>
            Rep vs teoria{' '}
            <span className="font-bold text-text-secondary">{balance.practiceShare}%</span>
          </span>
        )}
        {prevWeek?.focusLabel && (
          <span>
            W−1: {prevWeek.focusLabel}
            {prevWeek.mustTotal ? ` · MUST ${prevWeek.mustDone}/${prevWeek.mustTotal}` : ''}
          </span>
        )}
        {readOnly && <span className="text-amber-600 dark:text-amber-400">Archiwum</span>}
      </div>

      {hasDirection && (
        <div className="flex flex-wrap gap-2">
          {PILLAR.filter((p) => weekGoals[p.key]).map((p) => (
            <span
              key={p.key}
              className="rounded-lg border border-border-custom bg-background/60 px-2 py-1 text-[10px] font-semibold text-text-secondary"
            >
              {p.label}: {weekGoals[p.key]}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-1 border-t border-border-custom/80">
        <NavChip to="/?view=tydzien" label="Tydzień" />
        <NavChip to="/?view=projekty" label="Projekty" icon={<FolderKanban size={11} />} />
        <NavChip to="/?view=todo" label="Todo" />
        <NavChip to="/?view=keep" label="Keep" />
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border-custom bg-background/50 px-3 py-2.5 min-w-0">
      <p className="flex items-center gap-1 text-[8px] font-black uppercase text-text-muted tracking-wider">
        {icon} {label}
      </p>
      <p
        className={`text-[11px] font-bold mt-1 truncate ${muted ? 'text-text-muted' : 'text-text-primary'}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function NavChip({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={() => {
        try {
          const v = new URL(to, window.location.origin).searchParams.get('view');
          if (v) localStorage.setItem('vanguard_view', v);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1 rounded-lg border border-border-custom px-2.5 py-1.5 text-[10px] font-black uppercase text-text-muted hover:text-primary hover:border-primary/30"
    >
      {icon}
      {label}
      <ArrowRight size={10} />
    </Link>
  );
}
