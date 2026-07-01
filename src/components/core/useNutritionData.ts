import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw, formatWarsawDate } from '../../lib/date';
import { useHaptics } from '../../hooks/useHaptics';
import type { Database } from '../../lib/database.types';

export type TodayEntry = Database['public']['Tables']['daily_food_entries']['Row'];
export type DailyNutritionRow = Database['public']['Tables']['daily_nutrition']['Row'];

export interface UseNutritionDataProps {
  session: any;
  weeklyCalories: number;
  refreshSignal?: number;
}

export function useNutritionData({ session, weeklyCalories, refreshSignal }: UseNutritionDataProps) {
  const userId = session?.user?.id;
  const todayRaw = getTodayWarsaw();
  const haptics = useHaptics();

  const [proteinGoal, setProteinGoal] = useState(150);
  const [kcalTarget, setKcalTarget] = useState(1800);
  const [weeklyBudget, setWeeklyBudget] = useState(12600);
  const [rows, setRows] = useState<Pick<DailyNutritionRow, 'date' | 'protein' | 'calories' | 'food_quality_analysis' | 'insulin_load' | 'avg_food_quality'>[]>([]);
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [forecast, setForecast] = useState<{
    forecast_30d_weight_kg: number | null;
    forecast_60d_weight_kg: number | null;
    forecast_90d_weight_kg: number | null;
    forecast_30d_bf_pct: number | null;
    forecast_60d_bf_pct: number | null;
    forecast_90d_bf_pct: number | null;
    days_to_goal_est: number | null;
    adaptive_correction_kcal: number | null;
  } | null>(null);
  const [forecastNote, setForecastNote] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
  const [activeChartTab, setActiveChartTab] = useState<'calories' | 'protein'>('calories');

  const fetchRows = useCallback(async () => {
    if (!userId) return;
    try {
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
        .select('*')
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
          .select('target_kcal, protein_floor_g, verdict, forecast_30d_weight_kg, forecast_60d_weight_kg, forecast_90d_weight_kg, forecast_30d_bf_pct, forecast_60d_bf_pct, forecast_90d_bf_pct, days_to_goal_est, adaptive_correction_kcal')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (targetRow?.target_kcal) {
          setKcalTarget(targetRow.target_kcal);
          setWeeklyBudget(targetRow.target_kcal * 7);
        }
        if (targetRow?.protein_floor_g) setProteinGoal(targetRow.protein_floor_g);
        if (targetRow) {
          setForecast({
            forecast_30d_weight_kg: targetRow.forecast_30d_weight_kg,
            forecast_60d_weight_kg: targetRow.forecast_60d_weight_kg,
            forecast_90d_weight_kg: targetRow.forecast_90d_weight_kg,
            forecast_30d_bf_pct: targetRow.forecast_30d_bf_pct,
            forecast_60d_bf_pct: targetRow.forecast_60d_bf_pct,
            forecast_90d_bf_pct: targetRow.forecast_90d_bf_pct,
            days_to_goal_est: targetRow.days_to_goal_est,
            adaptive_correction_kcal: targetRow.adaptive_correction_kcal,
          });
        }
        const verdict = targetRow?.verdict;
        const verdictObj = verdict && typeof verdict === 'object' && !Array.isArray(verdict)
          ? (verdict as Record<string, unknown>)
          : undefined;
        const suggestions = verdictObj?.food_suggestions;
        if (Array.isArray(suggestions)) setAiSuggestions(suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3));
        if (typeof verdictObj?.forecast_note === 'string') setForecastNote(verdictObj.forecast_note);
      } catch (e) {
        console.error('nutrition_targets fetch failed', e);
      }
    })();
    void fetchRows();
    void fetchTodayEntries();
  }, [userId, fetchRows, fetchTodayEntries, refreshSignal]);

  const handleSaved = useCallback(() => {
    void fetchRows();
    void fetchTodayEntries();
  }, [fetchRows, fetchTodayEntries]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!userId || deletingId) return;
    haptics.light();
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
  }, [userId, deletingId, fetchRows, fetchTodayEntries, haptics]);

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
  const todayKcalFromEntries = todayEntries.reduce((s, e) => s + (e.calories ?? 0), 0);
  const todayKcal = todayEntries.length > 0 ? Math.round(todayKcalFromEntries) : (todayRow?.calories ?? 0);
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

  // Group today's entries by meal type
  const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const MEAL_LABEL: Record<string, string> = {
    breakfast: 'Śniadanie',
    lunch: 'Obiad',
    dinner: 'Kolacja',
    snack: 'Przekąska',
  };

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
  }, [mealGroups]);

  return {
    userId,
    todayRaw,
    haptics,
    proteinGoal,
    kcalTarget,
    weeklyBudget,
    rows,
    todayEntries,
    deletingId,
    aiSuggestions,
    forecast,
    forecastNote,
    isExpanded, setIsExpanded,
    selectedMealType, setSelectedMealType,
    activeChartTab, setActiveChartTab,
    fetchRows,
    fetchTodayEntries,
    handleSaved,
    deleteEntry,
    caloriesProgress,
    chart,
    avgProtein7d,
    todayRow,
    todayProtein,
    todayKcal,
    todayInsulinLoad,
    proteinPct,
    todayMissingData,
    remainingKcalToday,
    todayMacros,
    totalGrams,
    pPct,
    cPct,
    fPct,
    todayQualityScore,
    todayAnalysis,
    todayAnalysisIsStale,
    todayAnalysisRow,
    mealGroups,
    mealGroupsWithEntries,
  };
}
