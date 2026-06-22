import { getTodayWarsaw, formatWarsawDate } from '../../lib/date';
import { useEffect, useState } from 'react';
import { Brain, CheckCircle2, Target, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MODE_STYLE: Record<string, { label: string; cls: string }> = {
  rescue:   { label: 'Tryb ratunkowy', cls: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  minimal:  { label: 'Tryb minimalny', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  normal:   { label: 'Normalny',        cls: 'bg-primary/10 text-primary border-primary/20' },
  optimal:  { label: 'Optymalny',       cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
};

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function DailySnapshotCard({ session }: { session: any }) {
  const userId = session?.user?.id;
  const today = getTodayWarsaw();
  const hourNum = parseInt(new Date().toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }), 10);

  const [snap, setSnap] = useState<any>(null);
  const [strainState, setStrainState] = useState<{ daily_status: string | null; main_limiter: string | null } | null>(null);
  const [midday, setMidday] = useState<{ status: string | null; blocker: string | null } | null>(null);
  const [dayScore, setDayScore] = useState<number | null>(null);
  const [rescueStreak, setRescueStreak] = useState(0);
  const [savingScore, setSavingScore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const yd = new Date(today + 'T12:00:00Z'); yd.setUTCDate(yd.getUTCDate() - 1);
    const yesterday = formatWarsawDate(yd);
    const d14 = new Date(today + 'T12:00:00Z'); d14.setUTCDate(d14.getUTCDate() - 14);
    const ago14 = formatWarsawDate(d14);

    Promise.all([
      supabase
        .from('daily_reconciliations')
        .select('date, planning_summary, day_score, midday_status, midday_blocker')
        .eq('user_id', userId)
        .in('date', [today, yesterday])
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('daily_strain')
        .select('date, daily_status, main_limiter')
        .eq('user_id', userId)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('daily_reconciliations')
        .select('date, planning_summary')
        .eq('user_id', userId)
        .gte('date', ago14)
        .order('date', { ascending: false }),
    ]).then(([recRes, strainRes, historyRes]) => {
      const rec = recRes.data;
      const strain = strainRes.data;
      const history = historyRes.data;
      if (rec?.planning_summary) setSnap({ ...(rec.planning_summary as Record<string, any>), day_score: rec.day_score, date: rec.date });
      if (rec?.day_score != null) {
        setDayScore(rec.day_score);
      }
      if (strain) setStrainState({ daily_status: strain.daily_status, main_limiter: strain.main_limiter });
      if (rec?.midday_status || rec?.midday_blocker) setMidday({ status: rec.midday_status, blocker: rec.midday_blocker });

      // Calculate consecutive rescue days
      let streak = 0;
      for (const row of (history ?? [])) {
        const mode = (row.planning_summary as any)?.mode;
        if (mode === 'rescue') streak++;
        else break;
      }
      setRescueStreak(streak);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId, today]);

  const saveScore = async (score: number) => {
    if (savingScore) return;
    setSavingScore(true);
    setDayScore(score);
    const { error } = await supabase.from('daily_reconciliations').upsert(
      { user_id: userId, date: today, status: 'answered', mode: 'checkin', day_score: score },
      { onConflict: 'user_id,date', ignoreDuplicates: false }
    );
    if (error) {
      console.warn('[DailySnapshotCard] saveScore failed:', error.message);
      setDayScore(null);
    }
    setSavingScore(false);
  };

  if (loading || !snap) return null;

  const mode = MODE_STYLE[snap.mode ?? 'normal'] ?? MODE_STYLE.normal;
  const isYesterday = snap.date && snap.date !== today;
  const showScorePicker = hourNum >= 17 && dayScore == null && !isYesterday;

  return (
    <section className="animate-fadeIn rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={13} className="text-primary" />
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">
            Plan dnia{isYesterday ? ' (wczoraj)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dayScore != null && (
            <span className="text-[11px] font-black text-text-primary">{dayScore}/10</span>
          )}
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${mode.cls}`}>
            {mode.label}
          </span>
        </div>
      </div>

      {/* Rescue streak alert */}
      {rescueStreak >= 3 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2">
          <span className="text-[13px]">🔴</span>
          <p className="text-[11px] font-bold text-rose-400">
            {rescueStreak} dni z rzędu tryb ratunkowy — czas zresetować priorytety
          </p>
        </div>
      )}

      {/* One clear move */}
      {snap.one_clear_move && (
        <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 mb-1.5 flex items-center gap-1">
            <Target size={9} /> Główny ruch
          </p>
          <p className="text-[13px] font-bold leading-snug text-text-primary">
            {snap.one_clear_move}
          </p>
        </div>
      )}

      {/* Top 3 */}
      {snap.top3 && snap.top3.length > 0 && snap.top3[0] !== snap.one_clear_move && (
        <div className="space-y-1.5">
          {snap.top3.slice(0, 3).map((item: string, i: number) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-black text-primary">
                {i + 1}
              </div>
              <p className="text-[12px] leading-snug text-text-secondary">{item}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tension action */}
      {snap.tension_action?.action && snap.tension_action.action !== 'Zdefiniuj ruch napięciowy' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-3 py-2">
          <Zap size={11} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-snug text-text-secondary">{snap.tension_action.action}</p>
        </div>
      )}

      {/* Midday blocker */}
      {midday?.blocker && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/15 bg-rose-500/[0.04] px-3 py-2">
          <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-rose-400" />
          <p className="text-[11px] leading-snug text-text-secondary">Bloker: {midday.blocker}</p>
        </div>
      )}

      {/* Strain state badge */}
      {strainState?.daily_status && (
        <div className="flex items-center gap-2 pt-1 border-t border-border-custom">
          <div className={`h-2 w-2 rounded-full ${
            strainState.daily_status === 'green' ? 'bg-emerald-500' :
            strainState.daily_status === 'yellow' ? 'bg-amber-500' : 'bg-rose-500'
          }`} />
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            {strainState.daily_status === 'green' ? 'Dobra kondycja' :
             strainState.daily_status === 'yellow' ? 'Umiarkowane zmęczenie' : 'Wysokie obciążenie'}
            {strainState.main_limiter && strainState.main_limiter !== 'recovery_ok' && ` · limiter: ${strainState.main_limiter}`}
          </span>
        </div>
      )}

      {/* Quick day score — shows after 17:00 if not yet scored */}
      {showScorePicker && (
        <div className="pt-1 border-t border-border-custom space-y-2">
          <p className="text-[9px] font-black uppercase tracking-wider text-text-muted">Jak był dzień? (1–10)</p>
          <div className="flex gap-1.5 flex-wrap">
            {SCORES.map(s => (
              <button
                key={s}
                onClick={() => saveScore(s)}
                disabled={savingScore}
                className={`h-8 w-8 rounded-xl text-[11px] font-black transition-all active:scale-90 cursor-pointer disabled:opacity-40
                  ${s <= 3 ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' :
                    s <= 6 ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' :
                             'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
