import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useStore, useUserId } from '../../../store/useStore';
import type { Tables, TablesInsert } from '../../../lib/database.types';
import { analyzeFoodQuality, analyzeTrainingLoad as requestTrainingLoad } from '../stats/statsApi';
import { exportStatsMarkdown, exportOuraCsv } from '../../../lib/stats/exportStats';
import { notify, confirmDialog } from '../../../lib/notify';
import type { NewMetricState } from '../stats/BodyMetricsSection';
import { mergeBodyMetricSavePayload } from '../../../lib/health/bodyMetrics';
import type { FoodAnalysisResult } from '../stats/FoodAnalysisSection';
import { getTodayWarsaw, shiftDateStr } from '../../../lib/date';
import { useStatsOverviewQuery } from '../../../lib/statsOverviewApi';
import { statsOverviewKeys } from '../../../lib/queryKeys';
import type { TrainingAnalysis } from '../stats/TrainingAnalysisSection';

type ExerciseLogRow = Tables<'exercise_logs'>;
export type EditableExerciseLog = Omit<ExerciseLogRow, 'weight' | 'reps'> & {
  weight: number | string | null;
  reps: number | string | null;
};
export type WorkoutSessionRow = Tables<'workout_sessions'> & { exercise_logs?: ExerciseLogRow[]; duration?: number | string };
export type EditFormState = { date: string | null; workout_day: string; logs: EditableExerciseLog[] };

export function useStatsData() {
  const userId = useUserId();
  const { userSettings } = useStore();
  const queryClient = useQueryClient();
  const { data: overview, isLoading: loading } = useStatsOverviewQuery(userId);
  const bodyData = overview?.bodyData ?? [];
  const recentSessions = overview?.recentSessions ?? [];
  const heightCm = overview?.heightCm ?? null;
  const trends = overview?.trends ?? {};
  const projections = overview?.projections ?? null;
  const refetchStats = () => {
    if (userId) queryClient.invalidateQueries({ queryKey: statsOverviewKeys.forUser(userId) });
  };
  const [newMetric, setNewMetric] = useState<NewMetricState>({ weight: '', waist: '', neck: '', chest: '', belly: '', hips: '', thigh: '', biceps_l: '', calf: '' });
  const [dateRange, setDateRange] = useState({
    from: shiftDateStr(getTodayWarsaw(), -7),
    to: getTodayWarsaw()
  });
  const [includeNutrition, setIncludeNutrition] = useState(true);
  const [includeJournal, setIncludeJournal] = useState(true);
  const [includeOura, setIncludeOura] = useState(true);
  const [includeHabits, setIncludeHabits] = useState(true);
  const [includeWorkouts, setIncludeWorkouts] = useState(true);
  const [includeBody, setIncludeBody] = useState(true);
  const [includeActivityWatch, setIncludeActivityWatch] = useState(true);
  const [analyzeDate, setAnalyzeDate] = useState(() => getTodayWarsaw());
  const [analyzePeriod, setAnalyzePeriod] = useState(1);
  const [analyzeResult, setAnalyzeResult] = useState<FoodAnalysisResult | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({ date: '', workout_day: '', logs: [] });
  const [trainingAnalysis, setTrainingAnalysis] = useState<TrainingAnalysis | null>(null);

  const saveMetricsMutation = useMutation({
    mutationFn: async () => {
      const today = getTodayWarsaw();
      const existingToday = bodyData.find((row) => row.date === today) ?? null;
      const payload = mergeBodyMetricSavePayload(today, userId!, existingToday, newMetric);
      if (!payload) {
        throw new Error('Podaj przynajmniej jeden pomiar.');
      }
      const { error } = await supabase
        .from('body_metrics')
        .upsert(payload as TablesInsert<'body_metrics'>, { onConflict: 'user_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      notify('Zapisano!', 'success');
      setNewMetric({ weight: '', waist: '', neck: '', chest: '', belly: '', hips: '', thigh: '', biceps_l: '', calf: '' });
      refetchStats();
    },
    onError: (error: Error) => {
      notify(error.message, 'error');
    }
  });

  const saveMetrics = (e: React.FormEvent) => {
    e.preventDefault();
    saveMetricsMutation.mutate();
  };

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchStats();
    },
    onError: (error: Error) => {
      notify(error.message, 'error');
    }
  });

  const deleteSession = async (id: string) => {
    if (!(await confirmDialog('Usunąć trening?'))) return;
    deleteSessionMutation.mutate(id);
  };

  const analyzeFoodMutation = useMutation({
    mutationFn: async () => {
      setAnalyzeResult(null);
      const res = await analyzeFoodQuality({
        userId: userId!,
        analyzeDate,
        analyzePeriod
      });
      if (!res.success) {
        throw new Error(res.error || 'Nieznany błąd');
      }
      return res;
    },
    onSuccess: (res) => {
      setAnalyzeResult(res);
    },
    onError: (err: Error) => {
      notify('Błąd analizy: ' + err.message, 'error');
    }
  });

  const analyzeFood = () => {
    analyzeFoodMutation.mutate();
  };

  const isAnalyzing = analyzeFoodMutation.isPending;

  const analyzeTrainingLoadMutation = useMutation({
    mutationFn: async () => {
      setTrainingAnalysis(null);
      const res = await requestTrainingLoad({
        userId: userId!,
        from: dateRange.from,
        to: dateRange.to
      });
      if (!res.success) {
        throw new Error(res.error || 'Nieznany błąd');
      }
      return res;
    },
    onSuccess: (res) => {
      setTrainingAnalysis(res);
    },
    onError: (err: Error) => {
      notify('Błąd analizy treningu: ' + err.message, 'error');
    }
  });

  const analyzeTrainingLoad = () => {
    analyzeTrainingLoadMutation.mutate();
  };

  const isAnalyzingTraining = analyzeTrainingLoadMutation.isPending;

  const startEditing = async (session: WorkoutSessionRow) => {
    if (!session) return;
    setEditingSession(session.id);
    setEditForm({
      date: session.date,
      workout_day: session.workout_day ?? '',
      logs: (session.exercise_logs || []).map((log) => ({ ...log }))
    });
  };

  const updateSessionMutation = useMutation({
    mutationFn: async () => {
      if (!editingSession) return;
      const { error: sessionError } = await supabase
        .from('workout_sessions')
        .update({ date: editForm.date!, workout_day: editForm.workout_day })
        .eq('id', editingSession);
      if (sessionError) throw sessionError;

      for (const log of editForm.logs) {
        const weight = log.weight === '' || log.weight == null ? null : Number(log.weight);
        const reps = log.reps === '' || log.reps == null ? null : Number.parseInt(String(log.reps), 10);
        if ((weight != null && Number.isNaN(weight)) || (reps != null && Number.isNaN(reps))) {
          throw new Error('Nieprawidłowa wartość w serii.');
        }
        if (reps == null) {
          throw new Error('Liczba powtórzeń jest wymagana — nie może być puste.');
        }
        const { error: logError } = await supabase.from('exercise_logs').update({
          weight,
          reps
        }).eq('id', log.id);
        if (logError) throw logError;
      }
    },
    onSuccess: () => {
      notify('Trening zaktualizowany!', 'success');
      setEditingSession(null);
      refetchStats();
    },
    onError: (err: Error) => {
      notify('Błąd podczas aktualizacji: ' + (err.message || String(err)), 'error');
    }
  });

  const updateSession = () => {
    updateSessionMutation.mutate();
  };

  const deleteLogMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercise_logs').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      setEditForm({ ...editForm, logs: editForm.logs.filter(l => l.id !== id) });
    },
    onError: (err: Error) => {
      notify('Błąd podczas usuwania serii: ' + (err.message || String(err)), 'error');
    }
  });

  const deleteLog = async (id: string) => {
    if (!(await confirmDialog('Usunąć tę serię?'))) return;
    deleteLogMutation.mutate(id);
  };

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      await exportStatsMarkdown({
        supabase,
        session: { user: { id: userId! }, access_token: '' },
        dateRange,
        userSettings,
        includeNutrition,
        includeJournal,
        includeOura,
        includeHabits,
        includeWorkouts,
        includeBody,
        includeActivityWatch,
      });
    },
    onError: (err: Error) => {
      console.error('Export markdown error:', err);
      notify('Błąd podczas generowania raportu: ' + (err.message || String(err)), 'error');
    }
  });

  const exportData = () => {
    exportDataMutation.mutate();
  };

  const isExporting = exportDataMutation.isPending;

  const exportOuraCSVMutation = useMutation({
    mutationFn: async () => {
      await exportOuraCsv({ supabase, session: { user: { id: userId! } }, dateRange });
    },
    onError: (err: Error) => {
      console.error('Export Oura CSV error:', err);
      notify('Błąd podczas generowania CSV Oura: ' + (err.message || String(err)), 'error');
    }
  });

  const exportOuraCSV = () => {
    exportOuraCSVMutation.mutate();
  };

  const isExportingOura = exportOuraCSVMutation.isPending;

  return {
    userId,
    loading,
    bodyData,
    recentSessions,
    newMetric, setNewMetric,
    heightCm,
    dateRange, setDateRange,
    isExporting,
    isExportingOura,
    includeNutrition, setIncludeNutrition,
    includeJournal, setIncludeJournal,
    includeOura, setIncludeOura,
    includeHabits, setIncludeHabits,
    includeWorkouts, setIncludeWorkouts,
    includeBody, setIncludeBody,
    includeActivityWatch, setIncludeActivityWatch,
    isAnalyzing,
    analyzeDate, setAnalyzeDate,
    analyzePeriod, setAnalyzePeriod,
    analyzeResult, setAnalyzeResult,
    editingSession, setEditingSession,
    showAllSessions, setShowAllSessions,
    editForm, setEditForm,
    trends,
    projections,
    isAnalyzingTraining,
    trainingAnalysis,
    saveMetrics,
    deleteSession,
    analyzeFood,
    analyzeTrainingLoad,
    startEditing,
    updateSession,
    deleteLog,
    exportData,
    exportOuraCSV,
  };
}
