import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Zap } from 'lucide-react';
import { format, subDays } from 'date-fns';

import { useStore } from '../../store/useStore';
import type { Tables, TablesInsert } from '../../lib/database.types';
import { calculateProjection } from './stats/statsCalculations';
import { analyzeFoodQuality, analyzeTrainingLoad as requestTrainingLoad, syncYazioHistory } from './stats/statsApi';
import { exportStatsMarkdown, exportOuraCsv } from './stats/exportStats';
import { TrainingAnalysisSection } from './stats/TrainingAnalysisSection';
import { WorkoutHistorySection } from './stats/WorkoutHistorySection';
import { BodyMetricsSection } from './stats/BodyMetricsSection';
import { DataExportSection } from './stats/DataExportSection';
import { FoodAnalysisSection } from './stats/FoodAnalysisSection';
import { getTodayWarsaw , nowWarsaw } from '../../lib/date';

type BodyMetricRow = Tables<'body_metrics'>;
type ExerciseLogRow = Tables<'exercise_logs'>;
type EditableExerciseLog = Omit<ExerciseLogRow, 'weight' | 'reps'> & {
  weight: number | string | null;
  reps: number | string | null;
};
type WorkoutSessionRow = Tables<'workout_sessions'> & { exercise_logs?: ExerciseLogRow[]; duration?: number | string };
type TrendPoint = { cur: number | null; prev: number | null };
type TrendsState = Partial<Record<'weight' | 'waist' | 'readiness' | 'sleep' | 'protein', TrendPoint>>;
type ProjectionResult = { value: string; change: string } | null;
type ProjectionState = Partial<Record<'weight' | 'waist', ProjectionResult>>;
type EditFormState = { date: string | null; workout_day: string; logs: EditableExerciseLog[] };
type FoodQualityItem = { food_quality_score: number; name: string; quality_reason: string };
type ProteinDistribution = { meal: string; protein_g: number; mps?: boolean; note?: string };
type FoodAnalysisDay = { date?: string; incomplete?: boolean; fasting?: boolean; score?: number };
type FoodAnalysisResult =
  | {
      success?: boolean;
      mode: 'single';
      fasting?: boolean;
      date?: string;
      day_quality_analysis?: string;
      day_quality_score?: number;
      items: FoodQualityItem[];
      protein_distribution?: ProteinDistribution[];
    }
  | {
      success?: boolean;
      mode: 'range';
      dateFrom?: string;
      dateTo?: string;
      avg_score?: number;
      days: FoodAnalysisDay[];
      pattern_analysis?: string;
      top_issues?: string[];
      strengths?: string[];
      action_steps?: string[];
      nutrition_profile?: string;
      trend?: string;
      trend_note?: string;
      best_day?: string;
      worst_day?: string;
      chronic_gaps?: string[];
      training_nutrition_note?: string;
    };
type TrainingAnalysisResult = Record<string, unknown> & { success?: boolean; error?: string };

export default function Stats({ session, topSlot = null, runningSlot = null }: { session: any; topSlot?: any; runningSlot?: any }) {
  const { userSettings } = useStore();
  const [loading, setLoading] = useState(true);
  const [bodyData, setBodyData] = useState<BodyMetricRow[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSessionRow[]>([]);
  const [newMetric, setNewMetric] = useState({ weight: '', waist: '' });
  const [dateRange, setDateRange] = useState({
    from: format(subDays(nowWarsaw(), 7), 'yyyy-MM-dd'),
    to: format(nowWarsaw(), 'yyyy-MM-dd')
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingOura, setIsExportingOura] = useState(false);
  const [includeYazio, setIncludeYazio] = useState(true);
  const [includeJournal, setIncludeJournal] = useState(true);
  const [includeOura, setIncludeOura] = useState(true);
  const [includeHabits, setIncludeHabits] = useState(true);
  const [includeWorkouts, setIncludeWorkouts] = useState(true);
  const [includeBody, setIncludeBody] = useState(true);
  const [includeActivityWatch, setIncludeActivityWatch] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeDate, setAnalyzeDate] = useState(() => getTodayWarsaw());
  const [analyzePeriod, setAnalyzePeriod] = useState(1);
  const [analyzeResult, setAnalyzeResult] = useState<FoodAnalysisResult | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({ date: '', workout_day: '', logs: [] });
  const [trends, setTrends] = useState<TrendsState>({});
  const [projections, setProjections] = useState<ProjectionState | null>(null);

  const [isAnalyzingTraining, setIsAnalyzingTraining] = useState(false);
  const [trainingAnalysis, setTrainingAnalysis] = useState<TrainingAnalysisResult | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: body },
        { data: sessions },
        { data: oura }
      ] = await Promise.all([
        supabase.from('body_metrics').select('*').eq('user_id', session.user.id).order('date', { ascending: true }),
        supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', session.user.id).order('date', { ascending: false }),
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60),
      ]);

      if (body) setBodyData(body);

      if (sessions) {
        setRecentSessions(sessions.map(s => ({
          ...s,
          duration: s.start_time && s.end_time ? Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000) : '--'
        })));
      }

      // Calculate Trends
      const newTrends: TrendsState = {};
      const ouraRaw = oura || [];

      if (body && body.length >= 2) {
        newTrends.weight = { cur: body[body.length - 1].weight, prev: body[body.length - 2].weight };
        newTrends.waist = { cur: body[body.length - 1].waist, prev: body[body.length - 2].waist };
      }
      if (ouraRaw.length >= 2) {
        newTrends.readiness = { cur: ouraRaw[0].readiness_score, prev: ouraRaw[1].readiness_score };
        newTrends.sleep = { cur: ouraRaw[0].total_sleep_hours, prev: ouraRaw[1].total_sleep_hours };
      }
      setTrends(newTrends);

      // Calculate Projections (6 weeks)
      if (body && body.length >= 3) {
        setProjections({
          weight: calculateProjection(body, 'weight'),
          waist: calculateProjection(body, 'waist')
        });
      }


    } catch (err) {
      console.error('Fetch Stats Error:', err);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function saveMetrics(e: any) {
    e.preventDefault();
    const today = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Warsaw' }).format(new Date());
    const payload: TablesInsert<'body_metrics'> = {
      user_id: session.user.id,
      date: today,
    };
    if (newMetric.weight !== '') payload.weight = parseFloat(newMetric.weight);
    if (newMetric.waist !== '') payload.waist = parseFloat(newMetric.waist);
    if (payload.weight == null && payload.waist == null) {
      alert('Podaj wagę albo talię.');
      return;
    }
    const { error } = await supabase.from('body_metrics').upsert(payload);
    if (error) alert(error.message);
    else { alert('Zapisano!'); fetchStats(); }
  }

  async function deleteSession(id: any) {
    if (confirm('Usunąć trening?')) {
      const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
      if (error) { alert(error.message); return; }
      fetchStats();
    }
  }
  async function syncHistory() {
    setIsSyncing(true);
    try {
      const res = await syncYazioHistory({
        supabase,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        userId: session.user.id,
        days: 25
      });
      if (res.success) {
        alert(`Zsynchronizowano ${res.synced_days} dni!`);
        fetchStats();
      } else {
        alert('Błąd synchronizacji: ' + res.error);
      }
    } catch (_err) {
      alert('Błąd połączenia z funkcją');
    } finally {
      setIsSyncing(false);
    }
  }

  async function analyzeFood() {
    setIsAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await analyzeFoodQuality({
        supabase,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        userId: session.user.id,
        analyzeDate,
        analyzePeriod
      });
      if (res.success) {
        setAnalyzeResult(res);
      } else {
        alert('Błąd analizy: ' + (res.error || 'Nieznany błąd'));
      }
    } catch (err) {
      alert('Błąd połączenia: ' + (err instanceof Error ? err.message : String(err)));
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
        userId: session.user.id,
        from: dateRange.from,
        to: dateRange.to
      });
      if (res.success) setTrainingAnalysis(res);
      else throw new Error(res.error || 'Nieznany błąd');
    } catch (err) {
      alert('Błąd analizy treningu: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsAnalyzingTraining(false);
    }
  }

  async function startEditing(session: any) {
    if (!session) return;
    setEditingSession(session.id);
    setEditForm({
      date: session.date,
      workout_day: session.workout_day ?? '',
      logs: (session.exercise_logs || []).map((log: any) => ({ ...log }))
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
      
      alert('Trening zaktualizowany!');
      setEditingSession(null);
      fetchStats();
    } catch (_err) {
      alert('Błąd podczas aktualizacji');
    }
  }
  async function deleteLog(id: any) {
    if (confirm('Usunąć tę serię?')) {
      const { error } = await supabase.from('exercise_logs').delete().eq('id', id);
      if (error) { alert(error.message); return; }
      setEditForm({ ...editForm, logs: editForm.logs.filter(l => l.id !== id) });
    }
  }

  async function exportData() {
    setIsExporting(true);
    try {
      await exportStatsMarkdown({
        supabase,
        session,
        dateRange,
        userSettings,
        includeYazio,
        includeJournal,
        includeOura,
        includeHabits,
        includeWorkouts,
        includeBody,
        includeActivityWatch,
      });
    } catch (err: any) {
      console.error('Export markdown error:', err);
      alert('Błąd podczas generowania raportu: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  }

  async function exportOuraCSV() {
    setIsExportingOura(true);
    try {
      await exportOuraCsv({ supabase, session, dateRange });
    } catch (err: any) {
      console.error('Export Oura CSV error:', err);
      alert('Błąd podczas generowania CSV Oura: ' + (err?.message || err));
    } finally {
      setIsExportingOura(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-neutral-500 uppercase font-black animate-pulse tracking-widest">Wczytywanie...</div>;

  const latestBody = bodyData?.[bodyData.length - 1] || null;

  return (
    <div className="space-y-6 pb-4">

      <BodyMetricsSection
        trends={trends}
        newMetric={newMetric}
        setNewMetric={setNewMetric}
        latestBody={latestBody}
        saveMetrics={saveMetrics}
      />

      <section className="space-y-4 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
        <DataExportSection
          dateRange={dateRange}
          setDateRange={setDateRange}
          includeWorkouts={includeWorkouts}
          setIncludeWorkouts={setIncludeWorkouts}
          includeBody={includeBody}
          setIncludeBody={setIncludeBody}
          includeYazio={includeYazio}
          setIncludeYazio={setIncludeYazio}
          includeJournal={includeJournal}
          setIncludeJournal={setIncludeJournal}
          includeOura={includeOura}
          setIncludeOura={setIncludeOura}
          includeHabits={includeHabits}
          setIncludeHabits={setIncludeHabits}
          includeActivityWatch={includeActivityWatch}
          setIncludeActivityWatch={setIncludeActivityWatch}
          syncHistory={syncHistory}
          isSyncing={isSyncing}
          exportData={exportData}
          isExporting={isExporting}
        />

        <FoodAnalysisSection
          analyzePeriod={analyzePeriod}
          setAnalyzePeriod={setAnalyzePeriod}
          analyzeResult={analyzeResult}
          setAnalyzeResult={setAnalyzeResult}
          analyzeDate={analyzeDate}
          setAnalyzeDate={setAnalyzeDate}
          analyzeFood={analyzeFood}
          isAnalyzing={isAnalyzing}
        />

        <button onClick={exportOuraCSV} disabled={isExportingOura} className="w-full rounded-xl border border-border-custom px-6 py-3.5 text-[10px] font-bold uppercase tracking-widest text-text-muted transition-colors hover:border-primary/45 hover:text-primary cursor-pointer">
          {isExportingOura ? 'Generowanie...' : 'Pobierz Oura (.csv)'}
        </button>
      </section>

      {topSlot}

      <TrainingAnalysisSection
        trainingAnalysis={trainingAnalysis}
        analyzeTrainingLoad={analyzeTrainingLoad}
        isAnalyzingTraining={isAnalyzingTraining}
      />

      <WorkoutHistorySection
        recentSessions={recentSessions}
        showAllSessions={showAllSessions}
        setShowAllSessions={setShowAllSessions}
        editingSession={editingSession}
        editForm={editForm}
        setEditForm={setEditForm}
        startEditing={startEditing}
        updateSession={updateSession}
        deleteSession={deleteSession}
        deleteLog={deleteLog}
        setEditingSession={setEditingSession}
      />

      {runningSlot}
    </div>
  );
}
