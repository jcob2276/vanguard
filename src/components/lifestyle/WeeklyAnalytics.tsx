import { useEffect, useMemo, useState } from 'react';
import { Activity, Flame, Moon, X, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatWarsawDate , nowWarsaw } from '../../lib/date';

function parseSafeDate(dateStr: string): Date {
  const clean = dateStr.replace(/[^\d-/]/g, '');
  const separators = clean.includes('-') ? '-' : '/';
  const parts = clean.split(separators);
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 12, 0, 0);
  }
  return new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
}

function last7Days() {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = nowWarsaw();
    d.setDate(d.getDate() - i);
    days.push(formatWarsawDate(d));
  }
  return days;
}

function dayLabel(dateStr: string) {
  const d = parseSafeDate(dateStr);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('pl-PL', { weekday: 'short' }).slice(0, 2).toUpperCase();
}

const LIMITER_PL: Record<string, string> = {
  sleep: 'Sen', calories: 'Kalorie', carbs: 'Węgle',
  cardio_load: 'Cardio', strength_load: 'Siłownia',
  mental_load: 'Głowa', recovery_ok: 'OK',
};

function MiniBar({ pct, color, today, onClick }: { pct: number; color: string; today: boolean; onClick?: () => void }) {
  return (
    <div className="flex h-16 flex-col justify-end cursor-pointer" onClick={onClick}>
      <div
        className={`w-full rounded-sm transition-all duration-700 ${color} ${today ? 'opacity-100' : 'opacity-60'} hover:opacity-100`}
        style={{ height: `${Math.max(pct, 6)}%` }}
      />
    </div>
  );
}

type DayDetail = {
  date: string;
  strain_score: number | null;
  daily_status: string | null;
  main_limiter: string | null;
  explanation: string | null;
  cardio_load: number | null;
  strength_load: number | null;
  cns_load: number | null;
  steps_load: number | null;
  sleep_hours: number | null;
  hrv_avg: number | null;
  kcal: number | null;
  day_score: number | null;
  mode: string | null;
};

export default function WeeklyAnalytics({ session }: { session: any }) {
  const userId = session?.user?.id;
  const days = useMemo(() => last7Days(), []);
  const todayStr = days[6];

  const [strain, setStrain] = useState<Record<string, number>>({});
  const [sleep, setSleep] = useState<Record<string, number>>({});
  const [hrv, setHrv] = useState<Record<string, number>>({});
  const [kcal, setKcal] = useState<Record<string, number>>({});
  const [kcalTarget, setKcalTarget] = useState(1800);
  const [strainDetails, setStrainDetails] = useState<Record<string, any>>({});
  const [aggDetails, setAggDetails] = useState<Record<string, any>>({});
  const [dayModes, setDayModes] = useState<Record<string, string>>({});
  const [dayScores, setDayScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DayDetail | null>(null);

  useEffect(() => {
    if (!userId) return;
    const from = days[0];

    Promise.all([
      supabase.from('daily_strain')
        .select('date, strain_score, daily_status, main_limiter, explanation, cardio_load, strength_load, cns_load, steps_load')
        .eq('user_id', userId).gte('date', from),
      supabase.from('vanguard_daily_aggregates')
        .select('date, sleep_hours, hrv_avg')
        .eq('user_id', userId).gte('date', from),
      supabase.from('daily_nutrition')
        .select('date, calories')
        .eq('user_id', userId).gte('date', from),
      supabase.from('nutrition_targets')
        .select('target_kcal').eq('user_id', userId)
        .order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_reconciliations')
        .select('date, planning_summary, day_score')
        .eq('user_id', userId).gte('date', from),
    ]).then(([{ data: strainRows }, { data: aggRows }, { data: nutRows }, { data: targetRow }, { data: recRows }]) => {
      const s: Record<string, number> = {};
      const sd: Record<string, any> = {};
      const sl: Record<string, number> = {};
      const ad: Record<string, any> = {};
      const h: Record<string, number> = {};
      const k: Record<string, number> = {};
      const m: Record<string, string> = {};

      (strainRows ?? []).forEach((r: any) => {
        s[r.date] = Number(r.strain_score);
        sd[r.date] = r;
      });
      (aggRows ?? []).forEach((r: any) => {
        sl[r.date] = Number(r.sleep_hours);
        if (r.hrv_avg) h[r.date] = Number(r.hrv_avg);
        ad[r.date] = r;
      });
      (nutRows ?? []).forEach((r: any) => { k[r.date] = Number(r.calories); });
      const ds: Record<string, number> = {};
      (recRows ?? []).forEach((r: any) => {
        const mode = (r.planning_summary as any)?.mode;
        if (mode) m[r.date] = mode;
        if (r.day_score != null) ds[r.date] = Number(r.day_score);
      });

      setStrain(s);
      setStrainDetails(sd);
      setSleep(sl);
      setAggDetails(ad);
      setHrv(h);
      setKcal(k);
      setDayModes(m);
      setDayScores(ds);
      if (targetRow?.target_kcal) setKcalTarget(Number(targetRow.target_kcal));
      setLoading(false);
    });
  }, [userId, days]);

  const maxStrain = Math.max(10, ...Object.values(strain));
  const maxSleep = 10;
  const maxHrv = Math.max(80, ...Object.values(hrv));

  const strainColor = (v: number) => {
    if (!v) return 'bg-border-custom';
    if (v >= 70) return 'bg-rose-500';
    if (v >= 50) return 'bg-amber-400';
    return 'bg-emerald-400';
  };

  const sleepColor = (v: number) => {
    if (!v) return 'bg-border-custom';
    if (v >= 7.5) return 'bg-indigo-400';
    if (v >= 6) return 'bg-indigo-300';
    return 'bg-rose-400';
  };

  const kcalColor = (v: number) => {
    if (!v) return 'bg-border-custom';
    const pct = v / kcalTarget;
    if (pct > 1.1) return 'bg-rose-400';
    if (pct >= 0.85) return 'bg-emerald-400';
    return 'bg-amber-400';
  };

  const avgStrain = Object.values(strain).length
    ? Math.round(Object.values(strain).reduce((a, b) => a + b, 0) / Object.values(strain).length)
    : null;
  const avgSleep = Object.values(sleep).filter(Boolean).length
    ? (Object.values(sleep).filter(Boolean).reduce((a, b) => a + b, 0) / Object.values(sleep).filter(Boolean).length).toFixed(1)
    : null;
  const avgHrv = Object.values(hrv).filter(Boolean).length
    ? Math.round(Object.values(hrv).filter(Boolean).reduce((a, b) => a + b, 0) / Object.values(hrv).filter(Boolean).length)
    : null;
  const totalKcal = Object.values(kcal).reduce((a, b) => a + b, 0);

  const openDay = (d: string) => {
    const sd = strainDetails[d];
    const ad = aggDetails[d];
    setSelected({
      date: d,
      strain_score: sd?.strain_score ?? null,
      daily_status: sd?.daily_status ?? null,
      main_limiter: sd?.main_limiter ?? null,
      explanation: sd?.explanation ?? null,
      cardio_load: sd?.cardio_load ?? null,
      strength_load: sd?.strength_load ?? null,
      cns_load: sd?.cns_load ?? null,
      steps_load: sd?.steps_load ?? null,
      sleep_hours: ad?.sleep_hours ?? null,
      hrv_avg: ad?.hrv_avg ?? null,
      kcal: kcal[d] ?? null,
      day_score: dayScores[d] ?? null,
      mode: dayModes[d] ?? null,
    });
  };

  if (loading) {
    return (
      <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm animate-pulse">
        <div className="h-4 w-32 rounded-full bg-border-custom mb-4" />
        <div className="h-20 rounded-xl bg-border-custom/50" />
      </section>
    );
  }

  return (
    <>
      <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm space-y-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">Ostatnie 7 dni — kliknij dzień po szczegóły</p>

        {/* Strain */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame size={12} className="text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Obciążenie</span>
            </div>
            {avgStrain !== null && <span className="text-[11px] font-black text-text-primary">śr. {avgStrain}</span>}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const v = strain[d] ?? 0;
              const pct = maxStrain > 0 ? (v / maxStrain) * 100 : 0;
              const isToday = d === todayStr;
              return (
                <div key={d} className="flex flex-col gap-1">
                  <MiniBar pct={pct} color={strainColor(v)} today={isToday} onClick={() => openDay(d)} />
                  <span className={`text-center text-[8px] font-bold ${isToday ? 'text-primary' : 'text-text-muted'}`}>{dayLabel(d)}</span>
                </div>
              );
            })}
          </div>
          {/* Mode dots */}
          {Object.keys(dayModes).length > 0 && (
            <div className="grid grid-cols-7 gap-1.5 mt-1.5">
              {days.map((d) => {
                const mode = dayModes[d];
                const dot = mode === 'rescue' ? 'bg-rose-500' : mode === 'minimal' ? 'bg-amber-400' : mode === 'optimal' ? 'bg-emerald-400' : mode === 'normal' ? 'bg-primary' : 'bg-transparent';
                return (
                  <div key={d} className="flex justify-center">
                    <div className={`h-1.5 w-1.5 rounded-full ${dot}`} title={mode ?? ''} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border-custom" />

        {/* Sleep */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Moon size={12} className="text-indigo-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Sen (h)</span>
            </div>
            {avgSleep !== null && <span className="text-[11px] font-black text-text-primary">śr. {avgSleep}h</span>}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const v = sleep[d] ?? 0;
              const pct = (v / maxSleep) * 100;
              const isToday = d === todayStr;
              return (
                <div key={d} className="flex flex-col gap-1">
                  <MiniBar pct={pct} color={sleepColor(v)} today={isToday} onClick={() => openDay(d)} />
                  <span className={`text-center text-[8px] font-bold ${isToday ? 'text-primary' : 'text-text-muted'}`}>{v ? v.toFixed(1) : '--'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* HRV */}
        {avgHrv !== null && (
          <>
            <div className="border-t border-border-custom" />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity size={12} className="text-violet-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">HRV</span>
                </div>
                <span className="text-[11px] font-black text-text-primary">śr. {avgHrv} ms</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d) => {
                  const v = hrv[d] ?? 0;
                  const pct = maxHrv > 0 ? (v / maxHrv) * 100 : 0;
                  const isToday = d === todayStr;
                  return (
                    <div key={d} className="flex flex-col gap-1">
                      <div className="flex h-10 flex-col justify-end cursor-pointer" onClick={() => openDay(d)}>
                        <div
                          className={`w-full rounded-sm transition-all duration-700 bg-violet-400 ${isToday ? 'opacity-100' : 'opacity-50'} hover:opacity-100`}
                          style={{ height: `${Math.max(v ? pct : 0, v ? 6 : 0)}%` }}
                        />
                      </div>
                      <span className={`text-center text-[8px] font-bold ${isToday ? 'text-primary' : 'text-text-muted'}`}>{v ? v : '--'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="border-t border-border-custom" />

        {/* Kcal per day */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-orange-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Kcal / cel {kcalTarget}</span>
            </div>
            {totalKcal > 0 && <span className="text-[11px] font-black text-text-primary">{totalKcal.toLocaleString('pl-PL')} tyg.</span>}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => {
              const v = kcal[d] ?? 0;
              const pct = kcalTarget > 0 ? (v / kcalTarget) * 100 : 0;
              const isToday = d === todayStr;
              return (
                <div key={d} className="flex flex-col gap-1">
                  <div className="flex h-16 flex-col justify-end cursor-pointer" onClick={() => openDay(d)}>
                    <div
                      className={`w-full rounded-sm transition-all duration-700 ${kcalColor(v)} ${isToday ? 'opacity-100' : 'opacity-60'} hover:opacity-100`}
                      style={{ height: `${Math.max(v ? Math.min(pct, 110) : 0, v ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className={`text-center text-[8px] font-bold ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                    {v ? `${Math.round(v / 100) * 100}` : '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Day detail bottom sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-sm rounded-[28px] border border-border-custom bg-surface shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                  {(() => {
                    const d = parseSafeDate(selected.date);
                    return isNaN(d.getTime())
                      ? selected.date
                      : d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
                  })()}
                </p>
                {selected.strain_score != null && (
                  <p className="text-[22px] font-black text-text-primary leading-tight mt-0.5">
                    Obciążenie <span className="text-primary">{Math.round(selected.strain_score)}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selected.day_score != null && (
                  <span className={`rounded-xl px-2.5 py-1 text-[13px] font-black ${
                    selected.day_score >= 7 ? 'bg-emerald-500/15 text-emerald-500' :
                    selected.day_score >= 4 ? 'bg-amber-500/15 text-amber-500' :
                                             'bg-rose-500/15 text-rose-500'
                  }`}>{selected.day_score}/10</span>
                )}
                {selected.mode && (
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border ${
                    selected.mode === 'rescue' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                    selected.mode === 'minimal' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                    selected.mode === 'optimal' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                    'bg-primary/10 text-primary border-primary/20'
                  }`}>{selected.mode}</span>
                )}
                <button onClick={() => setSelected(null)} className="rounded-full p-2 text-text-muted hover:bg-surface-solid cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Strain breakdown */}
            {(selected.cardio_load != null || selected.strength_load != null || selected.cns_load != null) && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Cardio', val: selected.cardio_load, color: 'text-red-400' },
                  { label: 'Siła', val: selected.strength_load, color: 'text-orange-400' },
                  { label: 'CNS', val: selected.cns_load, color: 'text-violet-400' },
                ].map(({ label, val, color }) => val != null ? (
                  <div key={label} className="rounded-2xl border border-border-custom bg-surface-solid/40 p-3 text-center">
                    <p className={`text-[16px] font-black ${color}`}>{Math.round(Number(val))}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">{label}</p>
                  </div>
                ) : null)}
              </div>
            )}

            {/* Biometrics */}
            <div className="grid grid-cols-3 gap-2">
              {selected.sleep_hours != null && (
                <div className="rounded-2xl border border-border-custom bg-surface-solid/40 p-3 text-center">
                  <p className="text-[16px] font-black text-indigo-400">{Number(selected.sleep_hours).toFixed(1)}h</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">Sen</p>
                </div>
              )}
              {selected.hrv_avg != null && (
                <div className="rounded-2xl border border-border-custom bg-surface-solid/40 p-3 text-center">
                  <p className="text-[16px] font-black text-violet-400">{Math.round(Number(selected.hrv_avg))}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">HRV ms</p>
                </div>
              )}
              {selected.kcal != null && selected.kcal > 0 && (
                <div className="rounded-2xl border border-border-custom bg-surface-solid/40 p-3 text-center">
                  <p className="text-[16px] font-black text-orange-400">{selected.kcal}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted mt-0.5">Kcal</p>
                </div>
              )}
            </div>

            {/* Main limiter + explanation */}
            {selected.main_limiter && selected.main_limiter !== 'recovery_ok' && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Limiter:</span>
                <span className="text-[11px] font-bold text-text-secondary">{LIMITER_PL[selected.main_limiter] ?? selected.main_limiter}</span>
              </div>
            )}
            {selected.explanation && (
              <p className="text-[11px] leading-relaxed text-text-muted">{selected.explanation}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
