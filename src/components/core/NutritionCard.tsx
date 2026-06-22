import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, X, Loader2, Sparkles, Zap, Flame, Droplet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw, formatWarsawDate } from '../../lib/date';
import FoodEntryModal from './nutrition/FoodEntryModal';

interface NutritionCardProps {
  weeklyCalories: number;
  syncYazio: () => void;
  isSyncing: boolean;
  session: any;
}

interface TodayEntry {
  id: string;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  amount: string | null;
  date: string;
  meal_type: string | null;
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};

function qualityColor(score: number): string {
  if (score >= 75) return 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10';
  if (score >= 55) return 'text-amber-400 border-amber-500/25 bg-amber-500/10';
  return 'text-rose-400 border-rose-500/25 bg-rose-500/10';
}

function getWeekdayAbbr(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr.slice(8);
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const day = date.getDay();
    const days = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
    return days[day] || dateStr.slice(8);
  } catch {
    return dateStr.slice(8);
  }
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
  const [rows, setRows] = useState<{
    date: string;
    protein: number | null;
    calories: number | null;
    food_quality_analysis: string | null;
    insulin_load: number | null;
    avg_food_quality: number | null;
  }[]>([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<TodayEntry | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
  const [activeChartTab, setActiveChartTab] = useState<'calories' | 'protein'>('calories');

  const fetchRows = useCallback(async () => {
    if (!userId) return;
    try {
      // Fetch by calendar date range, not row count — daily_nutrition only has
      // a row for days with logged entries, so .limit(7) on sparse-logging
      // weeks silently reaches back further than 7 calendar days.
      const since = (() => { const d = new Date(todayRaw + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 6); return formatWarsawDate(d); })();
      const { data } = await supabase
        .from('daily_nutrition')
        .select('date, protein, calories, food_quality_analysis, insulin_load, avg_food_quality')
        .eq('user_id', userId)
        .gte('date', since)
        .order('date', { ascending: true });
      if (data) setRows(data);
    } catch (e) {
      console.error('daily_nutrition fetch failed', e);
    }
  }, [userId, todayRaw]);

  const fetchTodayEntries = useCallback(async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('daily_food_entries')
        .select('id, name, brand, calories, protein, carbs, fat, amount, date, meal_type')
        .eq('user_id', userId)
        .eq('date', todayRaw)
        .order('logged_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (data) setTodayEntries(data);
    } catch (e) {
      console.error('daily_food_entries fetch failed', e);
    }
  }, [userId, todayRaw]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: targetRow } = await supabase
          .from('nutrition_targets')
          .select('target_kcal, protein_floor_g, verdict')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (targetRow?.target_kcal) {
          setKcalTarget(targetRow.target_kcal);
          setWeeklyBudget(targetRow.target_kcal * 7);
        }
        if (targetRow?.protein_floor_g) setProteinGoal(targetRow.protein_floor_g);
        const verdict = targetRow?.verdict;
        const suggestions = verdict && typeof verdict === 'object' && !Array.isArray(verdict)
          ? (verdict as Record<string, unknown>).food_suggestions
          : undefined;
        if (Array.isArray(suggestions)) setAiSuggestions(suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3));
      } catch (e) {
        console.error('nutrition_targets fetch failed', e);
      }
    })();
    fetchRows();
    fetchTodayEntries();
  }, [userId, fetchRows, fetchTodayEntries]);

  const handleSaved = useCallback(() => {
    fetchRows();
    fetchTodayEntries();
  }, [fetchRows, fetchTodayEntries]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!userId || deletingId) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.rpc('remove_food_entry', { p_user_id: userId, p_entry_id: id });
      if (error) throw new Error(error.message);
      await Promise.all([fetchRows(), fetchTodayEntries()]);
    } catch (e) {
      console.error('[NutritionCard] delete entry failed', e);
    } finally {
      setDeletingId(null);
    }
  }, [userId, deletingId, fetchRows, fetchTodayEntries]);

  const caloriesProgress = weeklyBudget > 0 ? Math.min((weeklyCalories / weeklyBudget) * 100, 100) : 0;

  const chart = useMemo(() => {
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayRaw + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - i);
      days.push(formatWarsawDate(d));
    }
    return days.map((key) => {
      const r = byDate.get(key);
      return {
        key, label: key.slice(8),
        protein: Number(r?.protein || 0), calories: Number(r?.calories || 0),
        analysis: r?.food_quality_analysis ?? null,
        insulin_load: r?.insulin_load != null ? Number(r.insulin_load) : null,
      };
    });
  }, [rows, todayRaw]);

  const avgProtein7d = useMemo(() => {
    const vals = chart.filter((r) => r.protein > 0).map((r) => r.protein);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [chart]);

  const todayRow = chart.find((r) => r.key === todayRaw);
  const todayProtein = todayRow?.protein ?? 0;
  const todayKcal = todayRow?.calories ?? 0;
  const todayInsulinLoad = todayRow?.insulin_load ?? null;
  const proteinPct = Math.min((todayProtein / proteinGoal) * 100, 100);
  const todayMissingData = todayKcal === 0 && todayProtein === 0;
  const remainingKcalToday = kcalTarget - todayKcal;

  const todayMacros = useMemo(() => {
    let p = 0, c = 0, f = 0;
    for (const e of todayEntries) {
      p += e.protein ?? 0;
      c += e.carbs ?? 0;
      f += e.fat ?? 0;
    }
    return {
      protein: Math.round(p * 10) / 10,
      carbs: Math.round(c * 10) / 10,
      fat: Math.round(f * 10) / 10,
    };
  }, [todayEntries]);

  const totalGrams = todayMacros.protein + todayMacros.carbs + todayMacros.fat;
  const pPct = totalGrams > 0 ? (todayMacros.protein / totalGrams) * 100 : 0;
  const cPct = totalGrams > 0 ? (todayMacros.carbs / totalGrams) * 100 : 0;
  const fPct = totalGrams > 0 ? (todayMacros.fat / totalGrams) * 100 : 0;

  const todayQualityScore = useMemo(
    () => rows.find((r) => r.date === todayRaw)?.avg_food_quality ?? null,
    [rows, todayRaw],
  );

  const todayAnalysisRow = chart.find((r) => r.key === todayRaw)?.analysis
    ? chart.find((r) => r.key === todayRaw)
    : chart.findLast((r) => r.analysis);
  const todayAnalysis = todayAnalysisRow?.analysis ?? null;
  const todayAnalysisIsStale = !!todayAnalysisRow && todayAnalysisRow.key !== todayRaw;

  const kcalBarColor = (v: number) => {
    if (!v) return 'bg-border-custom';
    const pct = v / kcalTarget;
    if (pct > 1.1) return 'bg-rose-400';
    if (pct >= 0.85) return 'bg-emerald-400';
    return 'bg-amber-400';
  };

  // Group today's entries by meal type, preserving insertion order within each group
  const mealGroups = useMemo(() => {
    const map: Record<string, TodayEntry[]> = {};
    for (const e of todayEntries) {
      const key = e.meal_type || 'snack';
      (map[key] ||= []).push(e);
    }
    return MEAL_ORDER.map((k) => ({
      key: k,
      label: MEAL_LABEL[k],
      entries: map[k] || [],
      totalKcal: (map[k] || []).reduce((s, e) => s + (e.calories ?? 0), 0),
      totalProtein: Math.round((map[k] || []).reduce((s, e) => s + (e.protein ?? 0), 0) * 10) / 10,
      totalCarbs: Math.round((map[k] || []).reduce((s, e) => s + (e.carbs ?? 0), 0) * 10) / 10,
      totalFat: Math.round((map[k] || []).reduce((s, e) => s + (e.fat ?? 0), 0) * 10) / 10,
    }));
  }, [todayEntries]);

  const mealGroupsWithEntries = useMemo(() => {
    return mealGroups.filter((g) => g.entries.length > 0);
  }, [mealGroups]);  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted">Żywienie</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEntryModal(true)}
            className="rounded-xl border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-[10px] font-black text-primary hover:bg-primary/10 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          >
            <Plus size={12} /> Dodaj posiłek
          </button>
        </div>
      </div>

      {/* Main Calorie HUD */}
      <div className="flex flex-col items-center justify-center py-4 bg-surface-solid/35 border border-border-custom/50 rounded-2xl mb-4 text-center">
        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-text-muted">Pozostało dzisiaj</span>
        <p className={`font-display text-[32px] font-black tracking-tight leading-none my-1.5 ${
          remainingKcalToday >= 0 ? 'text-emerald-500' : 'text-rose-500'
        }`}>
          {remainingKcalToday >= 0 ? `${remainingKcalToday}` : `+${Math.abs(remainingKcalToday)}`}
          <span className="text-[12px] font-bold text-text-secondary ml-1">kcal</span>
        </p>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
          <span>Zjedzone: <strong className="text-text-secondary">{todayKcal} kcal</strong></span>
          <span>·</span>
          <span>Cel: <strong className="text-text-secondary">{kcalTarget} kcal</strong></span>
        </div>
      </div>

      {/* Suma makro dzisiaj */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {/* Protein Box */}
        <div className="rounded-2xl border-l-4 border-l-primary/70 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-primary mb-1 flex items-center justify-center gap-1">
              <Zap size={9} className="fill-primary" /> Białko (B)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.protein}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-primary h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((todayMacros.protein / (proteinGoal || 1)) * 100, 100)}%` }} 
              />
            </div>
            <p className="text-[7.5px] text-text-muted font-bold mt-1">
              {proteinGoal > 0 ? `${Math.round((todayMacros.protein / proteinGoal) * 100)}% celu` : '—'}
            </p>
          </div>
        </div>

        {/* Carbs Box */}
        <div className="rounded-2xl border-l-4 border-l-amber-500/70 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-amber-500 mb-1 flex items-center justify-center gap-1">
              <Flame size={9} className="fill-amber-500" /> Węgle (W)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.carbs}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${cPct}%` }} 
              />
            </div>
            <p className="text-[7.5px] text-text-muted font-bold mt-1">
              {Math.round(cPct)}% makro
            </p>
          </div>
        </div>

        {/* Fat Box */}
        <div className="rounded-2xl border-l-4 border-l-rose-500/70 border border-border-custom/40 bg-surface-solid/20 p-3 text-center flex flex-col justify-between">
          <div>
            <p className="text-[8px] font-black uppercase tracking-wider text-rose-500 mb-1 flex items-center justify-center gap-1">
              <Droplet size={9} className="fill-rose-500" /> Tłuszcze (T)
            </p>
            <p className="font-display text-[17px] font-black text-text-primary">{todayMacros.fat}g</p>
          </div>
          <div>
            <div className="w-full h-1 bg-border-custom rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-rose-400 h-full rounded-full transition-all duration-500" 
                style={{ width: `${fPct}%` }} 
              />
            </div>
            <p className="text-[7.5px] text-text-muted font-bold mt-1">
              {Math.round(fPct)}% makro
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Macro Balance split progress bar */}
      {totalGrams > 0 && (
        <div className="mb-4 bg-surface-solid/10 border border-border-custom/30 rounded-xl p-2">
          <div className="h-2 w-full rounded-full bg-border-custom overflow-hidden flex">
            <div className="bg-primary h-full transition-all duration-700" style={{ width: `${pPct}%` }} title={`Białko: ${Math.round(pPct)}%`} />
            <div className="bg-amber-400 h-full transition-all duration-700" style={{ width: `${cPct}%` }} title={`Węglowodany: ${Math.round(cPct)}%`} />
            <div className="bg-rose-400 h-full transition-all duration-700" style={{ width: `${fPct}%` }} title={`Tłuszcze: ${Math.round(fPct)}%`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[8px] font-black text-text-muted uppercase tracking-wider">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> Białko ({Math.round(pPct)}%)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Węgle ({Math.round(cPct)}%)</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Tłuszcze ({Math.round(fPct)}%)</span>
          </div>
        </div>
      )}

      {/* Unified 7-Day Chart Widget */}
      <div className="mt-4 border-t border-border-custom/50 pt-4">
        {/* Chart switcher tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-solid/15 border border-border-custom/50 mb-3">
          <button
            onClick={() => setActiveChartTab('calories')}
            className={`flex-1 text-center py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeChartTab === 'calories'
                ? 'bg-surface-solid shadow-sm text-text-primary border border-border-custom/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Kalorie (7d)
          </button>
          <button
            onClick={() => setActiveChartTab('protein')}
            className={`flex-1 text-center py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              activeChartTab === 'protein'
                ? 'bg-surface-solid shadow-sm text-text-primary border border-border-custom/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Białko (7d)
          </button>
        </div>

        {activeChartTab === 'calories' ? (
          <div className="mt-2">
            <div className="relative h-24 border-b border-border-custom/50 flex items-end justify-between px-2 pb-1">
              {/* Target baseline */}
              {kcalTarget > 0 && (
                <div 
                  className="absolute left-0 right-0 border-t border-dashed border-amber-500/40 z-0 pointer-events-none"
                  style={{ bottom: `${(kcalTarget / Math.max(...chart.map(c => c.calories), kcalTarget, 1)) * 100}%` }}
                />
              )}
              {chart.map((d) => {
                const maxVal = Math.max(...chart.map(c => c.calories), kcalTarget, 1);
                const pct = (d.calories / maxVal) * 100;
                const isToday = d.key === todayRaw;
                const weekday = getWeekdayAbbr(d.key);
                return (
                  <div key={d.key} className="flex-1 flex flex-col items-center group relative z-10 h-full justify-end">
                    <div
                      className={`w-3.5 rounded-t-md transition-all duration-500 cursor-pointer ${
                        isToday
                          ? 'bg-gradient-to-t from-orange-500 to-amber-400 opacity-100 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                          : d.calories >= kcalTarget
                            ? 'bg-emerald-500/60 dark:bg-emerald-500/70 hover:opacity-100 opacity-70'
                            : 'bg-text-secondary/40 hover:opacity-85 opacity-55'
                      }`}
                      style={{ height: `${Math.max(pct, 5)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 bg-surface-solid border border-border-custom px-1.5 py-0.5 rounded text-[8px] font-bold text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-20 whitespace-nowrap">
                      {weekday}: {d.calories} kcal
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between px-2 mt-1.5">
              {chart.map((d) => {
                const isToday = d.key === todayRaw;
                const weekday = getWeekdayAbbr(d.key);
                return (
                  <span key={d.key} className={`flex-1 text-center text-[7.5px] font-black ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                    {isToday ? 'Dziś' : weekday}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <div className="relative h-24 border-b border-border-custom/50 flex items-end justify-between px-2 pb-1">
              {/* Protein Target baseline */}
              {proteinGoal > 0 && (
                <div 
                  className="absolute left-0 right-0 border-t border-dashed border-primary/40 z-0 pointer-events-none"
                  style={{ bottom: `${(proteinGoal / Math.max(...chart.map(c => c.protein), proteinGoal, 1)) * 100}%` }}
                />
              )}
              {chart.map((d) => {
                const maxVal = Math.max(...chart.map(c => c.protein), proteinGoal, 1);
                const pct = (d.protein / maxVal) * 100;
                const isToday = d.key === todayRaw;
                const weekday = getWeekdayAbbr(d.key);
                return (
                  <div key={d.key} className="flex-1 flex flex-col items-center group relative z-10 h-full justify-end">
                    <div
                      className={`w-3.5 rounded-t-md transition-all duration-500 cursor-pointer ${
                        isToday
                          ? 'bg-gradient-to-t from-primary to-indigo-400 opacity-100 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
                          : d.protein >= proteinGoal
                            ? 'bg-emerald-500/60 dark:bg-emerald-500/70 hover:opacity-100 opacity-70'
                            : 'bg-primary/45 hover:opacity-85 opacity-55'
                      }`}
                      style={{ height: `${Math.max(pct, 5)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 bg-surface-solid border border-border-custom px-1.5 py-0.5 rounded text-[8px] font-bold text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md z-20 whitespace-nowrap">
                      {weekday}: {d.protein}g B
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between px-2 mt-1.5">
              {chart.map((d) => {
                const isToday = d.key === todayRaw;
                const weekday = getWeekdayAbbr(d.key);
                return (
                  <span key={d.key} className={`flex-1 text-center text-[7.5px] font-black ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                    {isToday ? 'Dziś' : weekday}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sync / targets dashboard progress bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {/* Weekly calories budget */}
        <div className="rounded-2xl border border-border-custom/50 bg-surface-solid/10 p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">Bilans tygodniowy</span>
              <span className="text-[10px] font-bold text-text-secondary">{weeklyCalories.toLocaleString('pl-PL')} / {weeklyBudget.toLocaleString('pl-PL')} kcal</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border-custom">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 shadow-[0_2px_8px_rgba(249,115,22,0.15)] transition-all duration-1000"
                style={{ width: `${caloriesProgress}%` }}
              />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-text-muted">
            <span>Pozostało w budżecie: <strong className="text-text-secondary">{Math.max(weeklyBudget - weeklyCalories, 0).toLocaleString('pl-PL')} kcal</strong></span>
            <span>{Math.round(caloriesProgress)}%</span>
          </div>
        </div>

        {/* Protein today */}
        <div className="rounded-2xl border border-border-custom/50 bg-surface-solid/10 p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-text-muted">Białko dzisiaj</span>
                {todayInsulinLoad != null && (
                  <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                    todayInsulinLoad > 70 ? 'border-rose-500/25 bg-rose-500/10 text-rose-500'
                    : todayInsulinLoad > 40 ? 'border-amber-500/25 bg-amber-500/10 text-amber-500'
                    : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
                  }`}>
                    IL {Math.round(todayInsulinLoad)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-text-secondary">{todayProtein}g / {proteinGoal}g</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border-custom">
              <div
                className="h-full rounded-full bg-primary shadow-[0_2px_8px_rgba(79,70,229,0.2)] transition-all duration-700"
                style={{ width: `${proteinPct}%` }}
              />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-text-muted">
            <span>{avgProtein7d != null ? `śr. 7d: ${avgProtein7d}g/d` : 'brak średniej'}</span>
            <span>{Math.round(proteinPct)}%</span>
          </div>
        </div>
      </div>

      {/* Food quality analysis */}
      {todayAnalysis && (
        <div className="mt-3.5 rounded-xl bg-text-primary/[0.02] border border-border-custom/50 p-3">
          <p className="text-[9px] uppercase font-black tracking-wider text-text-muted mb-1">
            Analiza jakości jedzenia{todayAnalysisIsStale ? ` (${todayAnalysisRow!.key})` : ''}
          </p>
          <p className="text-[11.5px] leading-relaxed text-text-secondary">{todayAnalysis}</p>
        </div>
      )}

      {/* ── Dzisiaj: remaining + grouped meal log ──────────────────────────────── */}
      <div className="my-4 border-t border-border-custom/50" />

      {/* Expandable / Collapsible toggle card banner */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-col p-3.5 rounded-2xl border border-border-custom bg-surface-solid/15 cursor-pointer group select-none hover:bg-surface-solid/25 active:scale-[0.99] transition-all mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-text-secondary font-display flex items-center gap-2">
              {isExpanded ? 'Ukryj dzisiejsze posiłki' : 'Pokaż dzisiejsze posiłki'}
              <span className={`text-[10px] transition-transform duration-300 text-text-muted ${isExpanded ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </span>
            {todayQualityScore != null && (
              <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${qualityColor(todayQualityScore)}`}>
                Jakość {todayQualityScore}
              </span>
            )}
          </div>
          <span className={`text-[12px] font-black font-display ${
            todayMissingData ? 'text-text-muted'
            : remainingKcalToday >= 0 ? 'text-emerald-500'
            : 'text-rose-400'
          }`}>
            {todayMissingData
              ? `cel ${kcalTarget} kcal`
              : remainingKcalToday >= 0
              ? `${remainingKcalToday} kcal wolnych`
              : `${Math.abs(remainingKcalToday)} kcal za dużo`}
          </span>
        </div>
        
        {/* Logged meals preview (shown only when collapsed) */}
        {!isExpanded && (
          <div className="mt-2 border-t border-border-custom/20 pt-2">
            {todayEntries.length === 0 ? (
              <p className="text-[9.5px] text-text-muted italic">Brak wpisów — kliknij, by rozwinąć lub dodać szybki posiłek</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {mealGroupsWithEntries.map((g) => {
                  const mealIcon = {
                    breakfast: '🍳',
                    lunch: '🍲',
                    dinner: '🥗',
                    snack: '🍎'
                  }[g.key] || '🍽️';
                  return (
                    <span key={g.key} className="inline-flex items-center gap-1 rounded-lg bg-surface-solid border border-border-custom/40 px-2 py-0.5 text-[9px] font-bold text-text-secondary shadow-sm">
                      <span>{mealIcon}</span>
                      <span>{g.label}</span>
                      <span className="text-text-primary font-black ml-0.5">{g.totalKcal} kcal</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grouped meal sections */}
      {isExpanded && (
        <div className="space-y-4 animate-fadeIn">
          {MEAL_ORDER.map((key) => {
            const group = mealGroups.find(g => g.key === key) || {
              key,
              label: MEAL_LABEL[key],
              entries: [],
              totalKcal: 0,
              totalProtein: 0,
              totalCarbs: 0,
              totalFat: 0
            };

            const mealIcon = {
              breakfast: '🍳',
              lunch: '🍲',
              dinner: '🥗',
              snack: '🍎'
            }[key] || '🍽️';

            const hasEntries = group.entries.length > 0;

            return (
              <div key={key} className="rounded-2xl border border-border-custom/70 bg-surface-solid/5 p-4 space-y-3">
                {/* Meal group header with subtotals and quick add button */}
                <div className="flex items-center justify-between border-b border-border-custom/40 pb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-text-secondary font-display flex items-center gap-1.5">
                    <span className="text-[14px]">{mealIcon}</span>
                    {group.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {hasEntries && (
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-text-muted">
                        <span className="rounded bg-surface-solid border border-border-custom/40 px-1.5 py-0.5 text-text-primary">{group.totalKcal} kcal</span>
                        <span>·</span>
                        <span className="text-primary">{group.totalProtein}B</span>
                        <span>·</span>
                        <span className="text-amber-500">{group.totalCarbs}W</span>
                        <span>·</span>
                        <span className="text-rose-400">{group.totalFat}T</span>
                      </div>
                    )}
                    <button
                      onClick={() => { setSelectedMealType(key); setShowEntryModal(true); }}
                      className="rounded-full border border-primary/20 bg-primary/[0.04] p-1 text-primary hover:bg-primary/10 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
                      title={`Dodaj do posiłku: ${group.label}`}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>

                {/* Entries in this meal */}
                {hasEntries ? (
                  <div className="space-y-2">
                    {group.entries.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border-custom/40 bg-surface px-3 py-2.5 transition-all hover:bg-surface-solid/30">
                        <button
                          onClick={() => { setEditEntry(e); setShowEntryModal(true); }}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <div className="flex items-baseline gap-1.5">
                            <p className="text-[12px] font-black text-text-primary truncate">{e.name}</p>
                            {e.amount && <span className="text-[9px] text-text-muted shrink-0">{e.amount}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {e.protein != null && e.protein > 0.05 && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[8px] font-black text-primary">
                                {Math.round(e.protein * 10) / 10}B
                              </span>
                            )}
                            {e.carbs != null && e.carbs > 0.05 && (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-black text-amber-500">
                                {Math.round(e.carbs * 10) / 10}W
                              </span>
                            )}
                            {e.fat != null && e.fat > 0.05 && (
                              <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-black text-rose-500">
                                {Math.round(e.fat * 10) / 10}T
                              </span>
                            )}
                          </div>
                        </button>
                        <span className="shrink-0 text-[11px] font-black text-text-secondary bg-surface-solid/60 px-2 py-0.5 rounded-lg border border-border-custom/30">
                          {e.calories ?? '?'} kcal
                        </span>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          disabled={!!deletingId}
                          className="shrink-0 rounded-full p-1 text-text-muted/50 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-40"
                        >
                          {deletingId === e.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div 
                    onClick={() => { setSelectedMealType(key); setShowEntryModal(true); }}
                    className="border border-dashed border-border-custom/70 hover:border-primary/40 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-primary/[0.02] group/slot py-3.5"
                  >
                    <Plus size={13} className="text-text-muted group-hover/slot:text-primary transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-text-muted group-hover/slot:text-primary transition-colors">
                      Dodaj do posiłku
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI suggestions */}
      {aiSuggestions.length > 0 && remainingKcalToday > 200 && (
        <div className="mt-3.5 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={11} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-wider text-primary">AI sugeruje na dziś</span>
          </div>
          <div className="space-y-1">
            {aiSuggestions.map((s, i) => (
              <p key={i} className="text-[11.5px] text-text-secondary leading-snug">• {s}</p>
            ))}
          </div>
        </div>
      )}

      {showEntryModal && (
        <FoodEntryModal
          session={session}
          onClose={() => { setShowEntryModal(false); setEditEntry(null); setSelectedMealType(undefined); }}
          onSaved={handleSaved}
          initialEditEntry={editEntry ?? undefined}
          initialMealType={selectedMealType}
        />
      )}
    </section>
  );
}
