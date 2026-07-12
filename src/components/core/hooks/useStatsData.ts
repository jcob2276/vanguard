import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { useStatsOverviewQuery, statsOverviewKeys } from '../../../lib/statsOverviewApi';

type ExerciseLogRow = Tables<'exercise_logs'>;
type EditableExerciseLog = Omit<ExerciseLogRow, 'weight' | 'reps'> & {
  weight: number | string | null;
  reps: number | string | null;
};
type WorkoutSessionRow = Tables<'workout_sessions'> & { exercise_logs?: ExerciseLogRow[]; duration?: number | string };
type EditFormState = { date: string | null; workout_day: string; logs: EditableExerciseLog[] };
type TrainingAnalysisResult = Record<string, unknown> & { success?: boolean; error?: string };

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
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingOura, setIsExportingOura] = useState(false);
  const [includeNutrition, setIncludeNutrition] = useState(true);
  const [includeJournal, setIncludeJournal] = useState(true);
  const [includeOura, setIncludeOura] = useState(true);
  const [includeHabits, setIncludeHabits] = useState(true);
  const [includeWorkouts, setIncludeWorkouts] = useState(true);
  const [includeBody, setIncludeBody] = useState(true);
  const [includeActivityWatch, setIncludeActivityWatch] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeDate, setAnalyzeDate] = useState(() => getTodayWarsaw());
  const [analyzePeriod, setAnalyzePeriod] = useState(1);
  const [analyzeResult, setAnalyzeResult] = useState<FoodAnalysisResult | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({ date: '', workout_day: '', logs: [] });

  const [isAnalyzingTraining, setIsAnalyzingTraining] = useState(false);
  const [trainingAnalysis, setTrainingAnalysis] = useState<TrainingAnalysisResult | null>(null);

  async function saveMetrics(e: React.FormEvent) {
    e.preventDefault();
    const today = getTodayWarsaw();
    const existingToday = bodyData.find((row) => row.date === today) ?? null;
    const payload = mergeBodyMetricSavePayload(today, userId!, existingToday, newMetric);
    if (!payload) {
      notify('Podaj przynajmniej jeden pomiar.', 'error');
      return;
    }
    const { error } = await supabase
      .from('body_metrics')
      .upsert(payload as TablesInsert<'body_metrics'>, { onConflict: 'user_id,date' });
    if (error) notify(error.message, 'error');
    else {
      notify('Zapisano!', 'success');
      setNewMetric({ weight: '', waist: '', neck: '', chest: '', belly: '', hips: '', thigh: '', biceps_l: '', calf: '' });
      refetchStats();
    }
  }

  async function deleteSession(id: string) {
    if (!(await confirmDialog('Usunąć trening?'))) return;
    const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
    if (error) { notify(error.message, 'error'); return; }
    refetchStats();
  }

  async function analyzeFood() {
    setIsAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await analyzeFoodQuality({
        supabase,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        userId: userId!,
        analyzeDate,
        analyzePeriod
      });
      if (res.success) {
        setAnalyzeResult(res);
      } else {
        notify('Błąd analizy: ' + (res.error || 'Nieznany błąd'), 'error');
      }
    } catch (err: unknown) {
      notify('Błąd połączenia: ' + (err instanceof Error ? (err as Error).message : String(err)), 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function analyzeTrainingLoad() {
    setIsAnalyzingTraining(true);
    setTrainingAnalysis(null);
    try {
      const res = await requestTrainingLoad({
        supabase,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        userId: userId!,
        from: dateRange.from,
        to: dateRange.to
      });
      if (res.success) setTrainingAnalysis(res);
      else throw new Error(res.error || 'Nieznany błąd');
    } catch (err: unknown) {
      notify('Błąd analizy treningu: ' + (err instanceof Error ? (err as Error).message : String(err)), 'error');
    } finally {
      setIsAnalyzingTraining(false);
    }
  }

  async function startEditing(session: WorkoutSessionRow) {
    if (!session) return;
    setEditingSession(session.id);
    setEditForm({
      date: session.date,
      workout_day: session.workout_day ?? '',
      logs: (session.exercise_logs || []).map((log) => ({ ...log }))
    });
  }

  async function updateSession() {
    if (!editingSession) return;
    try {
      // 1. Update session date
      const { error: sessionError } = await supabase
        .from('workout_sessions')
        .update({ date: editForm.date!, workout_day: editForm.workout_day })
        .eq('id', editingSession);
      if (sessionError) throw sessionError;

      // 2. Update all logs
      for (const log of editForm.logs) {
        const weight = log.weight === '' || log.weight == null ? null : Number(log.weight);
        const reps = log.reps === '' || log.reps == null ? null : Number.parseInt(String(log.reps), 10);
        if ((weight != null && Number.isNaN(weight)) || (reps != null && Number.isNaN(reps))) {
          throw new Error('Nieprawidłowa wartość w serii.');
        }
        // reps is NOT NULL in the DB — sending null would throw a constraint
        // error, so reject explicitly here rather than silently keeping the
        // old value (the previous `reps ?? undefined` made a cleared field
        // look saved while quietly leaving the row untouched).
        if (reps == null) {
          throw new Error('Liczba powtórzeń jest wymagana — nie może być puste.');
        }
        const { error: logError } = await supabase.from('exercise_logs').update({
          weight,
          reps
        }).eq('id', log.id);
        if (logError) throw logError;
      }

      notify('Trening zaktualizowany!', 'success');
      setEditingSession(null);
      refetchStats();
    } catch (err: unknown) {
      notify('Błąd podczas aktualizacji', 'error');
    }
  }

  async function deleteLog(id: string) {
    if (!(await confirmDialog('Usunąć tę serię?'))) return;
    const { error } = await supabase.from('exercise_logs').delete().eq('id', id);
    if (error) { notify(error.message, 'error'); return; }
    setEditForm({ ...editForm, logs: editForm.logs.filter(l => l.id !== id) });
  }

  async function exportData() {
    setIsExporting(true);
    try {
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
    } catch (err: unknown) {
      console.error('Export markdown error:', err);
      notify('Błąd podczas generowania raportu: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  async function exportOuraCSV() {
    setIsExportingOura(true);
    try {
      await exportOuraCsv({ supabase, session: { user: { id: userId! } }, dateRange });
    } catch (err: unknown) {
      console.error('Export Oura CSV error:', err);
      notify('Błąd podczas generowania CSV Oura: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      setIsExportingOura(false);
    }
  }

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
