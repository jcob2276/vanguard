import Button from '../ui/Button';
import { Link } from 'react-router-dom';
import { ArrowRight, ListChecks, Target, TrendingUp, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GrowthContextData, GrowthLinkRow } from './hooks/useGrowthData';
import type { GrowthPrevWeekSummary, PowerListWeekStats } from '../../lib/growth/growthWeek';
import type { FocusProposal } from '../../lib/growth/growthOverview';
import type { LearningWeekPin } from '../../lib/growth/growth';
import { computeTheoryPracticeBalance } from '../../lib/growth/growthMastery';
import { Card } from '../ui/Card';

export default function GrowthCockpit({
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
  onSetFocus,
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
  onSetFocus?: () => void;
}) {
  const { weekGoals } = context;
  const balance = computeTheoryPracticeBalance(pins, linksById);
  const intention = weekGoals.intention || weekGoals.commitment || null;
  const hasDirection = !!(weekGoals.intention || weekGoals.cialo || weekGoals.duch || weekGoals.konto || weekGoals.commitment);
  const mustPct = mustTotal > 0 ? Math.round((mustDone / mustTotal) * 100) : 0;

  return (
    <Card variant="glass" padding="1.25rem" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-031)] text-text-muted">Tydzień · podsumowanie</p>
          {intention ? (
            <p className="text-sm font-bold text-text-primary mt-1 leading-snug line-clamp-2">{intention}</p>
          ) : (
            <p className="text-sm text-text-muted mt-1">
              Brak intencji — uzupełnij w{' '}
              <Link to="/?view=tydzien" className="text-primary font-bold hover:underline">
                podsumowaniu tygodnia
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatChip
          icon={<ListChecks size={11} />}
          label="5 zwycięstw"
          value={`${powerListStats.tasksDone}/${powerListStats.tasksSet || '?'}`}
          sub={powerListStats.daysWithWins > 0 ? `${powerListStats.daysWithWins}d aktywnych` : 'Planuj na Dziś'}
          color={powerListStats.tasksDone > 0 ? 'emerald' : 'muted'}
        />
        <StatChip
          icon={<Target size={11} />}
          label="MUST tygodnia"
          value={`${mustDone}/${mustTotal || 3}`}
          sub={mustTotal > 0 && mustPct === 100 ? 'Wszystkie' : mustTotal > 0 ? `${mustPct}%` : 'Ustaw poniżej'}
          color={mustDone > 0 ? (mustPct === 100 ? 'emerald' : 'amber') : 'muted'}
          bar={mustTotal > 0 ? { value: mustDone, max: mustTotal } : undefined}
        />
        <StatChip
          icon={<Zap size={11} />}
          label={context.sprintLabel ?? 'Sprint'}
          value={context.sprintGoal?.slice(0, 44) || '—'}
          color={context.sprintGoal ? 'primary' : 'muted'}
        />
        <StatChip
          icon={<TrendingUp size={11} />}
          label="KPI"
          value={
            context.kpiName && context.kpiValue != null
              ? `${context.kpiValue}${context.kpiTarget != null ? `/${context.kpiTarget}` : ''}`
              : '—'
          }
          sub={context.kpiName?.slice(0, 32) || context.activeProjectName?.slice(0, 32) || undefined}
          color={context.kpiValue != null ? 'primary' : 'muted'}
        />
      </div>

      {focusProposal ? (
        <Card
          variant="outline"
          padding="0.75rem"
          onClick={!readOnly ? onSetFocus : undefined}
          className="w-full text-left bg-primary/[0.05] flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--primary-25)' }}
        >
          <div className="min-w-0">
            <p className="text-2xs font-black uppercase text-primary tracking-wider">
              {focusProposal.source === 'saved' ? 'Focus tygodnia' : 'Propozycja focusu'}
            </p>
            <p className="text-base font-black text-text-primary mt-0.5 leading-tight">
              {focusProposal.parentLabel}
              {focusProposal.subskillLabel && (
                <span className="text-text-secondary font-bold"> → {focusProposal.subskillLabel}</span>
              )}
            </p>
            <p className="text-xs text-primary font-bold mt-0.5 tabular-nums">
              {weekFocusScore ?? focusProposal.score}/5
              {focusTarget != null && <span className="text-text-muted font-normal"> → cel {focusTarget}/5</span>}
            </p>
          </div>
          {!readOnly && <ArrowRight size={16} className="text-primary shrink-0" />}
        </Card>
      ) : !readOnly ? (
        <Button
          variant="outline"
          onClick={onSetFocus}
          className="w-full border-dashed border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.07] text-primary"
        >
          Ustaw focus tygodnia
        </Button>
      ) : null}

      {hasDirection && (weekGoals.cialo || weekGoals.duch || weekGoals.konto) && (
        <div className="space-y-1.5 pt-2 border-t border-border-custom/60">
          {weekGoals.cialo && <PillarLine emoji="🛡️" label="Ciało" text={weekGoals.cialo} />}
          {weekGoals.duch && <PillarLine emoji="⚡" label="Duch" text={weekGoals.duch} />}
          {weekGoals.konto && <PillarLine emoji="💰" label="Konto" text={weekGoals.konto} />}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted pt-1 border-t border-border-custom/60">
        {balance.total > 0 && (
          <span>
            Praktyka:{' '}
            <span className={`font-bold ${balance.practice >= balance.theory ? 'text-success' : 'text-warning'}`}>
              {balance.practiceShare}%
            </span>
            {balance.practice < balance.theory && ' — więcej praktyki, mniej teorii'}
          </span>
        )}
        {prevWeek?.focusLabel && (
          <span>
            W−1: {prevWeek.focusLabel}
            {prevWeek.mustTotal ? ` · MUST ${prevWeek.mustDone}/${prevWeek.mustTotal}` : ''}
          </span>
        )}
        {readOnly && <span className="text-warning dark:text-warning">Archiwum</span>}
      </div>

      <p className="text-xs text-text-muted leading-relaxed border-t border-border-custom/60 pt-3">
        Checkpointy i plan dnia ustawiasz na{' '}
        <Link to="/" className="font-bold text-primary hover:underline">
          Dziś
        </Link>
        {' '}przy „Zacznij dzień” — jedno miejsce, zero dubli.
      </p>
    </Card>
  );
}

function StatChip({
  icon,
  label,
  value,
  sub,
  color = 'muted',
  bar,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: 'emerald' | 'amber' | 'primary' | 'muted';
  bar?: { value: number; max: number };
}) {
  const colorMap = {
    emerald: 'text-success',
    amber: 'text-warning',
    primary: 'text-primary',
    muted: 'text-text-muted',
  };

  return (
    <div className="rounded-xl border border-border-custom bg-background/50 px-3 py-2.5 min-w-0">
      <p className="flex items-center gap-1 text-2xs font-black uppercase text-text-muted tracking-wider truncate">
        {icon} {label}
      </p>
      <p className={`text-sm font-black mt-1 truncate leading-snug ${colorMap[color]}`} title={value}>
        {value}
      </p>
      {sub && <p className="text-2xs text-text-muted mt-0.5 truncate">{sub}</p>}
      {bar && (
        <div className="mt-2 h-1 rounded-full bg-border-custom overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-all"
            style={{ width: `${Math.round((bar.value / bar.max) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PillarLine({ emoji, label, text }: { emoji: string; label: string; text: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-xs shrink-0 mt-0.5">{emoji}</span>
      <p className="text-xs text-text-secondary leading-snug">
        <span className="font-black text-text-muted">{label}: </span>
        {text}
      </p>
    </div>
  );
}
