import { Pressable } from '../ui/ControlPrimitives';
import { getTodayWarsaw, getWarsawHour } from '../../lib/date';
import { Brain, CheckCircle2, Target, Zap } from 'lucide-react';
import { useUserId } from '../../store/useStore';
import { useDailySnapshotQuery, useSaveDayScoreMutation } from '../../lib/dailySnapshotApi';
import Badge from '../ui/Badge';

const MODE_STYLE: Record<string, { label: string; color?: string }> = {
  rescue:   { label: 'Tryb ratunkowy', color: 'var(--color-danger)' },
  minimal:  { label: 'Tryb minimalny', color: 'var(--color-warning)' },
  normal:   { label: 'Normalny',        color: undefined },
  optimal:  { label: 'Optymalny',       color: 'var(--color-success)' },
};

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function DailySnapshotCard() {
  const userId = useUserId();
  const today = getTodayWarsaw();
  const hourNum = getWarsawHour();

  const { data, isLoading: loading } = useDailySnapshotQuery(userId, today);
  const saveScoreMutation = useSaveDayScoreMutation(userId, today);

  const snap = data?.snap ?? null;
  const strainState = data?.strainState ?? null;
  const midday = data?.midday ?? null;
  const dayScore = data?.dayScore ?? null;
  const rescueStreak = data?.rescueStreak ?? 0;
  const savingScore = saveScoreMutation.isPending;

  if (!userId) return null;

  const saveScore = (score: number) => {
    if (savingScore) return;
    saveScoreMutation.mutate(score);
  };

  if (loading || !snap) return null;

  const mode = MODE_STYLE[snap.mode ?? 'normal'] ?? MODE_STYLE.normal;
  const isYesterday = snap.date && snap.date !== today;
  const showScorePicker = hourNum >= 17 && dayScore == null && !isYesterday;

  return (
    <section className="animate-fadeIn card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={13} className="text-primary" />
          <p className="text-2xs font-bold uppercase tracking-[var(--legacy-arbitrary-004)] text-text-muted">
            Plan dnia{isYesterday ? ' (wczoraj)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dayScore != null && (
            <span className="text-xs font-black text-text-primary">{dayScore}/10</span>
          )}
          <Badge variant="tag" color={mode.color} className="text-2xs font-black uppercase tracking-wider">
            {mode.label}
          </Badge>
        </div>
      </div>

      {/* Rescue streak alert */}
      {rescueStreak >= 3 && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/[0.06] px-3 py-2">
          <span className="text-sm">🔴</span>
          <p className="text-xs font-bold text-danger">
            {rescueStreak} dni z rzędu tryb ratunkowy — czas zresetować priorytety
          </p>
        </div>
      )}

      {/* One clear move */}
      {snap.one_clear_move && (
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
          <p className="text-2xs font-black uppercase tracking-widest text-primary/60 mb-1.5 flex items-center gap-1">
            <Target size={10} /> Główny ruch
          </p>
          <p className="text-sm font-bold leading-snug text-text-primary">
            {snap.one_clear_move}
          </p>
        </div>
      )}

      {/* Top 3 */}
      {snap.top3 && snap.top3.length > 0 && snap.top3[0] !== snap.one_clear_move && (
        <div className="space-y-1.5">
          {snap.top3.slice(0, 3).map((item: string, i: number) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-black text-primary">
                {i + 1}
              </div>
              <p className="text-sm leading-snug text-text-secondary">{item}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tension action */}
      {snap.tension_action?.action && snap.tension_action.action !== 'Zdefiniuj ruch napięciowy' && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/15 bg-warning/[0.04] px-3 py-2">
          <Zap size={10} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-xs leading-snug text-text-secondary">{snap.tension_action.action}</p>
        </div>
      )}

      {/* Midday blocker */}
      {midday?.blocker && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/15 bg-danger/[0.04] px-3 py-2">
          <CheckCircle2 size={10} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-xs leading-snug text-text-secondary">Bloker: {midday.blocker}</p>
        </div>
      )}

      {/* Strain state badge */}
      {strainState?.daily_status && (
        <div className="flex items-center gap-2 pt-1 border-t border-border-custom">
          <div className={`h-2 w-2 rounded-full ${
            strainState.daily_status === 'green' ? 'bg-success' :
            strainState.daily_status === 'yellow' ? 'bg-warning' : 'bg-danger'
          }`} />
          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {strainState.daily_status === 'green' ? 'Dobra kondycja' :
             strainState.daily_status === 'yellow' ? 'Umiarkowane zmęczenie' : 'Wysokie obciążenie'}
            {strainState.main_limiter && strainState.main_limiter !== 'recovery_ok' && ` · limiter: ${strainState.main_limiter}`}
          </span>
        </div>
      )}

      {/* Quick day score — shows after 17:00 if not yet scored */}
      {showScorePicker && (
        <div className="pt-1 border-t border-border-custom space-y-2">
          <p className="text-2xs font-black uppercase tracking-wider text-text-muted">Jak był dzień? (1–10)</p>
          <div className="flex gap-1.5 flex-wrap">
            {SCORES.map(s => (
              <Pressable
                key={s}
                onClick={() => saveScore(s)}
                disabled={savingScore}
                className={`h-8 w-8 rounded-xl text-xs font-black transition-all active:scale-90 cursor-pointer disabled:opacity-[var(--opacity-40)]
                  ${s <= 3 ? 'bg-danger/10 text-danger hover:bg-danger/20' :
                    s <= 6 ? 'bg-warning/10 text-warning hover:bg-warning/20' :
                             'bg-success/10 text-success hover:bg-success/20'}`}
              >
                {s}
              </Pressable>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
