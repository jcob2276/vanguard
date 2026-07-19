import { notify } from '../../lib/notify';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw, shiftDateStr } from '../../lib/date';
import { useHaptics } from '../../hooks/useHaptics';
import { useUserId } from '../../store/useStore';
import type { Database } from '../../lib/database.types';
import { auditNutritionDay } from '../../lib/health/nutritionAudit';
import { calibrateNutrition } from '../../lib/health/nutritionCalibration';

export type TodayEntry = Database['public']['Tables']['daily_food_entries']['Row'];
export type DailyNutritionRow = Database['public']['Tables']['daily_nutrition']['Row'];

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_LABEL: Record<string, string> = {
  breakfast: 'Śniadanie',
  lunch: 'Obiad',
  dinner: 'Kolacja',
  snack: 'Przekąska',
};

export interface UseNutritionDataProps {
  weeklyCalories: number;
  refreshSignal?: number;
}

export function useNutritionData({ weeklyCalories, refreshSignal }: UseNutritionDataProps) {
  const userId = useUserId();
  const todayRaw = getTodayWarsaw();
  const haptics = useHaptics();
  const queryClient = useQueryClient();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string | undefined>(undefined);
  const [activeChartTab, setActiveChartTab] = useState<'calories' | 'protein'>('calories');

  const query = useQuery({
    queryKey: ['nutrition-data', userId, weeklyCalories],
    queryFn: async () => {
      if (!userId) return null;
      const since = shiftDateStr(todayRaw, -6);
      const calibrationSince = shiftDateStr(todayRaw, -27);
      const [targetRes, nutritionRes, entriesRes, calibrationRes, weightsRes] = await Promise.all([
        supabase
          .from('nutrition_targets')
          .select('target_kcal, protein_floor_g, verdict, forecast_30d_weight_kg, forecast_60d_weight_kg, forecast_90d_weight_kg, forecast_30d_bf_pct, forecast_60d_bf_pct, forecast_90d_bf_pct, days_to_goal_est, adaptive_correction_kcal')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('daily_nutrition')
          .select('date, protein, calories, carbs, fat, fiber, sugar, food_quality_analysis, insulin_load, avg_food_quality')
          .eq('user_id', userId)
          .gte('date', since)
          .order('date', { ascending: true }),
        supabase
          .from('daily_food_entries')
          .select('*')
          .eq('user_id', userId)
          .eq('date', todayRaw)
          .order('logged_at', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true }),
        supabase.from('daily_nutrition').select('date,calories').eq('user_id', userId)
          .gte('date', calibrationSince).order('date', { ascending: true }),
        supabase.from('body_metrics').select('date,weight').eq('user_id', userId)
          .gte('date', calibrationSince).not('weight', 'is', null).order('date', { ascending: true }),
      ]);

      const targetRow = targetRes.data;
      const rows = nutritionRes.data || [];
      const todayEntries = entriesRes.data || [];

      let proteinGoal = 150;
      let kcalTarget = 1800;
      let weeklyBudget = 12600;
      let forecast = null;
      let aiSuggestions: string[] = [];
      let forecastNote: string | null = null;

      if (targetRow?.target_kcal) {
        kcalTarget = targetRow.target_kcal;
        weeklyBudget = targetRow.target_kcal * 7;
      }
      if (targetRow?.protein_floor_g) {
        proteinGoal = targetRow.protein_floor_g;
      }
      if (targetRow) {
        forecast = {
          forecast_30d_weight_kg: targetRow.forecast_30d_weight_kg,
          forecast_60d_weight_kg: targetRow.forecast_60d_weight_kg,
          forecast_90d_weight_kg: targetRow.forecast_90d_weight_kg,
          forecast_30d_bf_pct: targetRow.forecast_30d_bf_pct,
          forecast_60d_bf_pct: targetRow.forecast_60d_bf_pct,
          forecast_90d_bf_pct: targetRow.forecast_90d_bf_pct,
          days_to_goal_est: targetRow.days_to_goal_est,
          adaptive_correction_kcal: targetRow.adaptive_correction_kcal,
        };
      }
      const verdict = targetRow?.verdict;
      const verdictObj = verdict && typeof verdict === 'object' && !Array.isArray(verdict)
        ? (verdict as Record<string, unknown>)
        : undefined;
      const suggestions = verdictObj?.food_suggestions;
      if (Array.isArray(suggestions)) {
        aiSuggestions = suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3);
      }
      if (typeof verdictObj?.forecast_note === 'string') {
        forecastNote = verdictObj.forecast_note;
      }

      return {
        proteinGoal,
        kcalTarget,
        weeklyBudget,
        rows,
        todayEntries,
        forecast,
        aiSuggestions,
        forecastNote,
        dayAudit: auditNutritionDay(todayEntries),
        calibration: calibrateNutrition(
          calibrationRes.data ?? [],
          (weightsRes.data ?? [])
            .filter((point): point is typeof point & { date: string } => typeof point.date === 'string')
            .map((point) => ({ date: point.date, weight_kg: point.weight })),
        ),
      };
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (userId) {
      void query.refetch();
    }
  }, [refreshSignal, userId, query]);

  const proteinGoal = query.data?.proteinGoal ?? 150;
  const kcalTarget = query.data?.kcalTarget ?? 1800;
  const weeklyBudget = query.data?.weeklyBudget ?? 12600;
  const rows = useMemo(() => query.data?.rows ?? [], [query.data?.rows]);
  const todayEntries = useMemo(() => query.data?.todayEntries ?? [], [query.data?.todayEntries]);
  const aiSuggestions = useMemo(() => query.data?.aiSuggestions ?? [], [query.data?.aiSuggestions]);
  const forecast = query.data?.forecast ?? null;
  const forecastNote = query.data?.forecastNote ?? null;
  const loading = query.isLoading;
  const dayAudit = query.data?.dayAudit ?? auditNutritionDay([]);
  const calibration = query.data?.calibration ?? calibrateNutrition([], []);

  const fetchRows = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const fetchTodayEntries = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const handleSaved = useCallback(() => {
    void query.refetch();
  }, [query]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('User ID is required');
      const { error } = await supabase.rpc('remove_food_entry', { p_user_id: userId, p_entry_id: id });
      if (error) throw new Error(error.message);
    },
    onMutate: (id) => {
      setDeletingId(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['nutrition-data', userId, weeklyCalories] });
    },
    onError: (e: unknown) => {
      notify('Nie udało się usunąć wpisu.', 'error');
      console.warn('[NutritionData] Failed to delete food entry:', e);
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const deleteEntry = useCallback(async (id: string) => {
    haptics.light();
    return deleteMutation.mutateAsync(id);
  }, [deleteMutation, haptics]);

  const caloriesProgress = weeklyBudget > 0 ? Math.min((weeklyCalories / weeklyBudget) * 100, 100) : 0;

  const chart = useMemo(() => {
    const byDate = new Map(rows.map((r) => [r.date, r]));
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(shiftDateStr(todayRaw, -i));
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
    dayAudit,
    calibration,
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
    loading,
  };
}
