import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';

interface NutritionCardProps {
  weeklyCalories: number;
  syncYazio: () => void;
  isSyncing: boolean;
  session: any;
}

export default function NutritionCard({
  weeklyCalories,
  syncYazio,
  isSyncing,
  session,
}: NutritionCardProps) {
  const userId = session?.user?.id;
  const todayRaw = getTodayWarsaw();

  const [proteinGoal, setProteinGoal] = useState(150);
  const [kcalTarget, setKcalTarget] = useState(1800);
  const [weeklyBudget, setWeeklyBudget] = useState(12600);
  const [rows, setRows] = useState<{ date: string; protein: number | null; calories: number | null; food_quality_analysis: string | null; insulin_load: number | null }[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('daily_nutrition')
        .select('date, protein, calories, food_quality_analysis, insulin_load')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);
      if (data) setRows([...data].reverse());
    } catch (e) {
      console.error('daily_nutrition fetch failed', e);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('nutrition_targets')
          .select('target_kcal, protein_floor_g')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.target_kcal) {
          setKcalTarget(data.target_kcal);
          setWeeklyBudget(data.target_kcal * 7);
        }
        if (data?.protein_floor_g) setProteinGoal(data.protein_floor_g);
      } catch (e) {
        console.error('nutrition_targets fetch failed', e);
      }
    })();
    fetchRows();
  }, [userId, fetchRows]);

  const caloriesProgress = weeklyBudget > 0 ? Math.min((weeklyCalories / weeklyBudget) * 100, 100) : 0;

  const chart = useMemo(() => {
    const result = rows.map((r) => ({
      key: r.date,
      label: r.date.slice(8),
      protein: Number(r.protein || 0),
      calories: Number(r.calories || 0),
      analysis: r.food_quality_analysis,
      insulin_load: r.insulin_load != null ? Number(r.insulin_load) : null,
    }));
    if (!result.some((r) => r.key === todayRaw)) {
      result.push({
        key: todayRaw,
        label: todayRaw.slice(8),
        protein: 0,
        calories: 0,
        analysis: null,
        insulin_load: null,
      });
    }
    return result.slice(-7);
  }, [rows, todayRaw]);

  const avgProtein7d = useMemo(() => {
    const vals = chart.filter((r) => r.protein > 0).map((r) => r.protein);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [chart]);

  const todayInsulinLoad = chart.find((r) => r.key === todayRaw)?.insulin_load ?? null;

  const todayRow = chart.find((r) => r.key === todayRaw);
  const todayProtein = todayRow?.protein ?? 0;
  const todayKcal = todayRow?.calories ?? 0;
  const proteinPct = Math.min((todayProtein / proteinGoal) * 100, 100);
  const todayMissingData = todayKcal === 0 && todayProtein === 0;

  const saveManual = async () => {
    if (!userId || saving) return;
    const kcal = parseInt(manualKcal, 10);
    const prot = parseInt(manualProtein, 10);
    if (isNaN(kcal) && isNaN(prot)) return;
    setSaving(true);
    try {
      await supabase.from('daily_nutrition').upsert(
        {
          user_id: userId,
          date: todayRaw,
          calories: isNaN(kcal) ? null : kcal,
          protein: isNaN(prot) ? null : prot,
        },
        { onConflict: 'user_id,date' }
      );
      setManualKcal('');
      setManualProtein('');
      setShowManual(false);
      await fetchRows();
    } catch (e) {
      console.error('manual nutrition save failed', e);
    } finally {
      setSaving(false);
    }
  };

  const kcalBarColor = (v: number) => {
    if (!v) return 'bg-border-custom';
    const pct = v / kcalTarget;
    if (pct > 1.1) return 'bg-rose-400';
    if (pct >= 0.85) return 'bg-emerald-400';
    return 'bg-amber-400';
  };

  const todayAnalysis =
    chart.find((r) => r.key === todayRaw)?.analysis ??
    chart.findLast((r) => r.analysis)?.analysis ??
    null;

  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">Żywienie</p>
        <div className="flex items-center gap-2">
          {todayMissingData && (
            <button
              onClick={() => setShowManual((v) => !v)}
              className="rounded-xl border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-black text-primary hover:bg-primary/10 active:scale-95 transition-all cursor-pointer"
            >
              + Dodaj ręcznie
            </button>
          )}
          <button
            onClick={syncYazio}
            disabled={isSyncing}
            className="rounded-xl border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary transition-all hover:bg-surface-solid hover:text-text-primary active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Sync Yazio"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showManual && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.03] p-3.5 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Dzisiejsze dane</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Kcal</label>
              <input
                type="number"
                value={manualKcal}
                onChange={(e) => setManualKcal(e.target.value)}
                placeholder={`cel: ${kcalTarget}`}
                className="w-full rounded-xl border border-border-custom bg-surface-solid/60 px-3 py-2 text-[12px] font-bold text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted block mb-1">Białko (g)</label>
              <input
                type="number"
                value={manualProtein}
                onChange={(e) => setManualProtein(e.target.value)}
                placeholder={`cel: ${proteinGoal}`}
                className="w-full rounded-xl border border-border-custom bg-surface-solid/60 px-3 py-2 text-[12px] font-bold text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>
          <button
            onClick={saveManual}
            disabled={saving}
            className="w-full rounded-2xl bg-primary py-2 text-[11px] font-black uppercase tracking-wider text-white disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
          >
            {saving ? 'Zapisuję...' : 'Zapisz'}
          </button>
        </div>
      )}

      <p className="font-display text-[26px] font-black tracking-tight text-text-primary leading-none">
        {weeklyCalories.toLocaleString('pl-PL')}
        <span className="ml-1 text-[12px] font-semibold text-text-muted tracking-normal">
          / {weeklyBudget.toLocaleString('pl-PL')} kcal
        </span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border-custom">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 shadow-[0_2px_8px_rgba(249,115,22,0.15)] transition-all duration-1000"
          style={{ width: `${caloriesProgress}%` }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10px] font-medium text-text-muted">
        <span>Tydzień</span>
        <span className="font-bold text-text-secondary">{Math.round(caloriesProgress)}% budżetu</span>
      </div>

      {/* Kcal per day chart */}
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {chart.map((d) => {
          const pct = kcalTarget > 0 ? Math.min((d.calories / kcalTarget) * 100, 110) : 0;
          const isToday = d.key === todayRaw;
          return (
            <div key={d.key} className="flex flex-col gap-1">
              <div className="flex h-10 flex-col justify-end">
                <div
                  className={`w-full rounded-sm transition-all duration-700 ${kcalBarColor(
                    d.calories
                  )} ${isToday ? 'opacity-100' : 'opacity-55'}`}
                  style={{ height: `${Math.max(d.calories ? pct : 0, d.calories ? 6 : 0)}%` }}
                />
              </div>
              <span className={`text-center text-[7px] font-bold ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                {d.calories ? `${Math.round(d.calories / 100) * 100}` : '--'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="my-4 border-t border-border-custom" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary font-display">
            Białko dzisiaj
          </span>
          {todayInsulinLoad != null && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                todayInsulinLoad > 70
                  ? 'border-rose-500/25 bg-rose-500/10 text-rose-500'
                  : todayInsulinLoad > 40
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-500'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
              }`}
            >
              IL {Math.round(todayInsulinLoad)}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-black text-primary font-display">{todayProtein}g</span>
          {avgProtein7d != null && <span className="text-[10px] text-text-muted">śr. {avgProtein7d}g/d</span>}
        </div>
      </div>
      <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-text-muted">
        <span>Cel {proteinGoal}g</span>
        <span>{Math.round(proteinPct)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border-custom">
        <div
          className="h-full rounded-full bg-primary shadow-[0_2px_8px_rgba(79,70,229,0.2)] transition-all duration-700"
          style={{ width: `${proteinPct}%` }}
        />
      </div>
      {chart.length > 0 && (
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {chart.map((d) => {
            const pct = Math.min((d.protein / proteinGoal) * 100, 100);
            const isToday = d.key === todayRaw;
            return (
              <div key={d.key} className="flex h-10 flex-col justify-end gap-1">
                <div
                  className={`rounded-sm transition-all ${
                    isToday ? 'bg-primary' : 'bg-primary/35 dark:bg-primary/50'
                  }`}
                  style={{ height: `${Math.max(pct, 6)}%` }}
                />
                <span className={`text-center text-[7px] font-bold ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {todayAnalysis && (
        <div className="mt-4 rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3">
          <p className="text-[9px] uppercase font-bold text-text-muted mb-1">Analiza jakości</p>
          <p className="text-[11px] leading-relaxed text-text-secondary">{todayAnalysis}</p>
        </div>
      )}
    </section>
  );
}
