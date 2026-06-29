import { useEffect, useState } from 'react';
import type { StrainData, OuraData } from './CockpitBanner';
import { isSprintClosingWeek } from '../../lib/goalSpine';
import type { SprintReview } from '../../lib/goalSpine';
import type { SprintPanelProps } from './SprintPanel';
import { SPRINT_SEASON } from './desktopUtils';
import SprintMetricsGrid from './SprintMetricsGrid';

const LIMITER_PL: Record<string, string> = {
  sleep: 'sen',
  calories: 'kalorie',
  carbs: 'węgle',
  cardio_load: 'cardio',
  strength_load: 'siłownia',
  mental_load: 'głowa',
  recovery_ok: 'OK',
};

function cockpitDecision(status: string, limiter: string | null, strain: number | null, provisional: boolean) {
  const fuelLimiter = limiter === 'calories' || limiter === 'carbs';
  if (status === 'green') return 'Możesz cisnąć — wszystko na zielono';
  if (status === 'red') {
    if (limiter === 'sleep') return 'Zadedykuj czas na sen i odpoczynek';
    if (fuelLimiter && !provisional) return 'Uzupełnij energię — niski bilans';
    return 'Ładowanie baterii / Regeneracja';
  }
  if (limiter === 'sleep') return 'Umiarkowanie — sen poniżej normy';
  if (fuelLimiter && !provisional) return 'Umiarkowanie — dobierz kalorie';
  if (limiter === 'cardio_load' || limiter === 'strength_load') return 'Umiarkowanie — wczoraj duży koszt';
  return (strain || 0) < 8 ? 'Lekki dzień — jest zapas' : 'Umiarkowanie — monitoruj';
}

export interface DesktopHeroProps {
  strain: StrainData | null;
  oura: OuraData[];
  sprint: SprintPanelProps['sprint'];
  sprintGoal: SprintPanelProps['sprintGoal'];
  sprintReview?: SprintReview | null;
  onSave: SprintPanelProps['onSave'];
  onSaveReview?: (reflection: string, complete: boolean) => Promise<void>;
  metrics: SprintPanelProps['metrics'];
  prevMetrics: SprintPanelProps['prevMetrics'];
  projectMetrics: SprintPanelProps['projectMetrics'];
  goals: SprintPanelProps['goals'];
  currentWeight: number | null;
  weight30ago: number | null;
}

export default function DesktopHero({
  strain,
  oura,
  sprint,
  sprintGoal,
  sprintReview = null,
  onSave,
  onSaveReview,
  metrics,
  prevMetrics,
  projectMetrics,
  goals,
  currentWeight,
  weight30ago,
}: DesktopHeroProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sprintGoal?.goal_text || '');
  const [saving, setSaving] = useState(false);
  const [reviewDraft, setReviewDraft] = useState(sprintReview?.reflection || '');
  const [reviewSaving, setReviewSaving] = useState(false);
  const latest = oura[oura.length - 1];
  const closingWeek = isSprintClosingWeek(sprint);

  useEffect(() => {
    setDraft(sprintGoal?.goal_text || '');
  }, [sprintGoal?.goal_text]);

  useEffect(() => {
    setReviewDraft(sprintReview?.reflection || '');
  }, [sprintReview?.reflection]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const handleSaveReview = async (complete: boolean) => {
    if (!onSaveReview) return;
    setReviewSaving(true);
    await onSaveReview(reviewDraft, complete);
    setReviewSaving(false);
  };

  const status = strain?.daily_status || 'unknown';
  const cfg = {
    green: { bg: 'bg-emerald-500/[0.05] border-emerald-500/25', dot: 'bg-emerald-500', pulse: 'bg-emerald-400', tag: 'ZIELONY' },
    yellow: { bg: 'bg-amber-500/[0.05] border-amber-500/25', dot: 'bg-amber-400', pulse: 'bg-amber-300', tag: 'ŻÓŁTY' },
    red: { bg: 'bg-rose-500/[0.05] border-rose-500/25', dot: 'bg-rose-500', pulse: 'bg-rose-400', tag: 'CZERWONY' },
  }[status] || { bg: 'bg-surface border-border-custom', dot: 'bg-text-muted', pulse: 'bg-text-muted', tag: '—' };

  const msg = strain ? cockpitDecision(status, strain.main_limiter, strain.strain_score, strain.fueling_provisional) : 'Obserwatorium — pełny obraz z SQL';
  const limiter = strain?.main_limiter && strain.main_limiter !== 'recovery_ok' ? LIMITER_PL[strain.main_limiter] : null;
  const readColor = !latest?.readiness_score
    ? 'text-text-muted'
    : latest.readiness_score >= 70
      ? 'text-emerald-500'
      : latest.readiness_score >= 50
        ? 'text-amber-500'
        : 'text-rose-500';

  return (
    <section id="sprint" className="scroll-mt-28">
      <div className={`rounded-[24px] border ${cfg.bg} border-primary/15 overflow-hidden`}>
        <div className="px-8 py-5 flex items-center justify-between gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="relative flex items-center justify-center w-3 h-3">
              <div className={`absolute w-3 h-3 rounded-full ${cfg.pulse} opacity-40 animate-ping`} />
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted">{cfg.tag}</span>
          </div>
          <p className="font-display text-[24px] font-black leading-tight text-text-primary">{msg}</p>
          {limiter && (
            <p className="text-[11px] text-text-secondary mt-1">
              Limiter: <span className="font-black">{limiter}</span>
            </p>
          )}
        </div>
        <div className="flex gap-4 shrink-0">
          {[
            { label: 'Readiness', val: latest?.readiness_score, unit: '/100', color: readColor },
            { label: 'HRV', val: latest?.hrv_avg, unit: 'ms' },
            { label: 'Sen', val: latest?.total_sleep_hours ? +latest.total_sleep_hours.toFixed(1) : null, unit: 'h' },
          ].map(({ label, val, unit, color }) => (
            <div key={label} className="text-center">
              <p className="text-[8px] font-black uppercase tracking-widest text-text-muted mb-1">{label}</p>
              <p className={`font-display text-[18px] font-black leading-none ${color || 'text-text-primary'}`}>
                {val ?? '—'}
                <span className="text-[10px] text-text-muted font-semibold ml-0.5">{unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-4 border-t border-primary/10 bg-primary/[0.02]">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-text-muted">
            Sprint scorecard
          </span>
          <span className="text-text-muted/40">·</span>
          <span className="text-[9px] font-bold text-text-muted">
            {sprint.sprintStart} → {sprint.sprintEnd}
          </span>
          <span className="text-text-muted/40 hidden sm:inline">·</span>
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-text-muted hidden sm:inline">
            PY{sprint.personalYear}
          </span>
          <span className="text-text-muted/40 hidden sm:inline">→</span>
          <span className="rounded-full border border-primary/20 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5 hidden sm:inline">
            Sprint {sprint.sprintNumber} · {SPRINT_SEASON[sprint.sprintNumber] || `S${sprint.sprintNumber}`}
          </span>
          <span className="text-[9px] font-bold text-text-muted ml-auto">
            Tydzień {sprint.weekInSprint}/12 · {sprint.daysLeft} dni · {sprint.pct}%
          </span>
        </div>

        {editing ? (
          <div className="flex gap-3 items-start">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) void handleSave();
                if (e.key === 'Escape') setEditing(false);
              }}
              placeholder="Cel sprintu — horyzont 12 tygodni"
              className="flex-1 bg-surface border border-primary/30 rounded-[14px] p-3 text-[14px] font-semibold text-text-primary outline-none resize-none focus:border-primary/60 leading-snug"
              rows={2}
              autoFocus
            />
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-[10px] bg-primary text-white text-[9px] font-black uppercase px-3 py-2 cursor-pointer hover:bg-primary-hover disabled:opacity-50"
              >
                {saving ? '…' : 'Zapisz'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-[10px] border border-border-custom text-[9px] font-black uppercase px-3 py-2 text-text-muted cursor-pointer"
              >
                Anuluj
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setDraft(sprintGoal?.goal_text || '');
              setEditing(true);
            }}
            className="text-left group cursor-pointer w-full"
          >
            {sprintGoal?.goal_text ? (
              <p className="text-[17px] font-black text-text-primary leading-snug group-hover:text-primary transition-colors">
                {sprintGoal.goal_text}
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-text-muted italic group-hover:text-primary transition-colors">
                + Dodaj cel sprintu
              </p>
            )}
          </button>
        )}

        <div className="h-1.5 mt-3 bg-border-custom rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${sprint.pct}%` }} />
        </div>

        {closingWeek && onSaveReview && (
          <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[8px] font-black uppercase tracking-widest text-amber-500">
                Zamknięcie sprintu
              </p>
              {sprintReview?.completed_at && (
                <span className="text-[9px] font-bold text-emerald-500">zamknięty</span>
              )}
            </div>
            <textarea
              value={reviewDraft}
              onChange={(e) => setReviewDraft(e.target.value)}
              placeholder="Co wyszło w tym sprincie? Jedna refleksja na zamknięcie."
              rows={2}
              className="w-full bg-surface border border-border-custom rounded-[12px] p-3 text-[13px] text-text-primary outline-none resize-none focus:border-primary/40"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSaveReview(false)}
                disabled={reviewSaving}
                className="rounded-[10px] border border-border-custom text-[9px] font-black uppercase px-3 py-2 text-text-muted cursor-pointer disabled:opacity-50"
              >
                Szkic
              </button>
              <button
                type="button"
                onClick={() => void handleSaveReview(true)}
                disabled={reviewSaving || !reviewDraft.trim()}
                className="rounded-[10px] bg-primary text-white text-[9px] font-black uppercase px-3 py-2 cursor-pointer disabled:opacity-50"
              >
                {reviewSaving ? '…' : 'Zamknij sprint'}
              </button>
            </div>
          </div>
        )}

        <SprintMetricsGrid
          metrics={metrics}
          prevMetrics={prevMetrics}
          projectMetrics={projectMetrics}
          goals={goals}
          currentWeight={currentWeight}
          weight30ago={weight30ago}
        />
      </div>
    </div>
    </section>
  );
}
