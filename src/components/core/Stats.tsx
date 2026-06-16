import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Activity, Zap, CheckSquare } from 'lucide-react';
import { format, subDays } from 'date-fns';

import { useStore } from '../../store/useStore';
import type { Tables, TablesInsert } from '../../lib/database.types';
import { calculateProjection, generateNarrative } from './stats/statsCalculations';
import { analyzeFoodQuality, analyzeTrainingLoad as requestTrainingLoad, syncYazioHistory } from './stats/statsApi';
import { exportStatsMarkdown, exportOuraCsv } from './stats/exportStats';
import { TrendArrow } from './stats/TrendArrow';
import { TrainingAnalysisSection } from './stats/TrainingAnalysisSection';
import { WorkoutHistorySection } from './stats/WorkoutHistorySection';

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
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
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
  const [analyzeDate, setAnalyzeDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }));
  const [analyzePeriod, setAnalyzePeriod] = useState(1);
  const [analyzeResult, setAnalyzeResult] = useState<FoodAnalysisResult | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({ date: '', workout_day: '', logs: [] });
  const [trends, setTrends] = useState<TrendsState>({});
  const [projections, setProjections] = useState<ProjectionState | null>(null);
  const [narrative, setNarrative] = useState('');
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

      setNarrative(generateNarrative(body, ouraRaw, sessions) ?? '');
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
      await supabase.from('workout_sessions').delete().eq('id', id);
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
        alert('B????d synchronizacji: ' + res.error);
      }
    } catch (_err) {
      alert('B????d po????czenia z funkcj??');
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
        alert('B????d analizy: ' + (res.error || 'Nieznany b????d'));
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
        userId: session.user.id
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
        const { error: logError } = await supabase.from('exercise_logs').update({ 
          weight, 
          reps: reps ?? undefined
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
      await supabase.from('exercise_logs').delete().eq('id', id);
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

  const isSunday = new Date().getDay() === 0;
  const latestBody = bodyData?.[bodyData.length - 1] || null;

  return (
    <div className="space-y-6 pb-4">
      {/* Raport Psychologiczny - Tylko w Niedzielę */}
      {narrative && isSunday && (
        <section className="animate-in fade-in zoom-in duration-700">
          <div className="rounded-[24px] border border-primary/10 bg-primary/[0.03] p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              <Zap size={12} className="text-primary" fill="currentColor" /> Analiza Behawioralna
            </h3>
            <p className="text-[13.5px] font-medium leading-relaxed text-text-primary">"{narrative}"</p>
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">Pomiary ciała</p>
            <h2 className="mt-1 font-display text-[18px] font-black tracking-tight text-text-primary">Waga i talia</h2>
          </div>
          <Activity className="text-primary/30 dark:text-primary/45" size={18} />
        </div>
        <div className="space-y-4 px-5 pb-5">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">
                Waga (kg) <TrendArrow current={trends.weight?.cur} previous={trends.weight?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.weight} onChange={e => setNewMetric({...newMetric, weight: e.target.value})} className="w-full rounded-xl border border-border-custom bg-surface p-3.5 text-lg font-black text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]" placeholder={latestBody?.weight ? String(latestBody.weight) : '--'} />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-text-muted font-display">
                Talia (cm) <TrendArrow current={trends.waist?.cur} previous={trends.waist?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.waist} onChange={e => setNewMetric({...newMetric, waist: e.target.value})} className="w-full rounded-xl border border-border-custom bg-surface p-3.5 text-lg font-black text-text-primary outline-none transition-all placeholder:text-text-muted focus:border-primary/50 focus:bg-surface-solid focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)]" placeholder={latestBody?.waist ? String(latestBody.waist) : '--'} />
            </div>
          </div>
          <button onClick={saveMetrics} className="w-full rounded-xl bg-primary hover:bg-primary-hover py-3.5 text-[12px] font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] font-display cursor-pointer">Zapisz pomiary</button>
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-border-custom bg-surface p-5 shadow-sm">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted font-display">Eksport</p>
          <h2 className="mt-1 font-display text-[18px] font-black tracking-tight text-text-primary">Raport danych</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-primary transition-colors" size={14} />
            <input
              type="date"
              value={dateRange.from}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              onChange={e => setDateRange({...dateRange, from: e.target.value})}
              className="w-full cursor-pointer appearance-none rounded-xl border border-border-custom bg-surface p-3 pl-10 text-[10px] font-bold text-text-primary outline-none transition-all focus:border-primary/70"
            />
          </div>
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-primary transition-colors" size={14} />
            <input
              type="date"
              value={dateRange.to}
              onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              onChange={e => setDateRange({...dateRange, to: e.target.value})}
              className="w-full cursor-pointer appearance-none rounded-xl border border-border-custom bg-surface p-3 pl-10 text-[10px] font-bold text-text-primary outline-none transition-all focus:border-primary/70"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-3 pt-1">
          {[
            { state: includeWorkouts, setter: setIncludeWorkouts, label: 'Trening (Siłownia/Strava)' },
            { state: includeBody, setter: setIncludeBody, label: 'Pomiary Ciała' },
            { state: includeYazio, setter: setIncludeYazio, label: 'Dieta (Yazio)' },
            { state: includeJournal, setter: setIncludeJournal, label: 'Notatnik (Telegram)' },
            { state: includeOura, setter: setIncludeOura, label: 'Oura Ring' },
            { state: includeHabits, setter: setIncludeHabits, label: 'Nawyki' },
            { state: includeActivityWatch, setter: setIncludeActivityWatch, label: 'Aktywność komputera (ActivityWatch)' },
          ].map(({ state, setter, label }) => (
            <button key={label} onClick={() => setter(!state)} className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${state ? 'bg-primary border-primary text-white shadow-[0_2px_6px_rgba(79,70,229,0.2)]' : 'border-border-custom bg-surface-solid/35'}`}>
                {state && <CheckSquare size={10} />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border-custom">
          <button onClick={syncHistory} disabled={isSyncing} className="text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-primary transition-colors cursor-pointer">
            {isSyncing ? 'Syncing...' : 'Sync Yazio'}
          </button>
          <button onClick={exportData} disabled={isExporting} className="ml-4 flex-1 rounded-xl bg-primary hover:bg-primary-hover px-6 py-3.5 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.99] font-display text-center cursor-pointer">
            {isExporting ? 'Generowanie...' : 'Pobierz Raport (.md)'}
          </button>
        </div>

        <div className="border-t border-border-custom pt-3 space-y-3">
          <div className="flex gap-1">
            {[1, 7, 14, 30].map(p => (
              <button
                key={p}
                onClick={() => { setAnalyzePeriod(p); setAnalyzeResult(null); }}
                className={`flex-1 rounded-xl border py-2 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  analyzePeriod === p 
                    ? 'border-primary/30 dark:border-primary/40 bg-primary/[0.06] text-primary font-bold shadow-none' 
                    : 'border-border-custom bg-surface-solid/40 text-text-muted hover:text-text-primary'
                }`}
              >
                {p === 1 ? '1D' : `${p}D`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {analyzePeriod === 1 && (
              <input
                type="date"
                value={analyzeDate}
                onChange={e => { setAnalyzeDate(e.target.value); setAnalyzeResult(null); }}
                className="flex-1 rounded-xl border border-border-custom bg-surface px-3 py-2 text-[10px] font-bold uppercase text-text-secondary focus:outline-none focus:border-primary/45"
              />
            )}
            {analyzePeriod > 1 && (
              <p className="flex-1 text-[10px] font-bold uppercase text-text-muted">
                Ostatnie {analyzePeriod} dni
              </p>
            )}
            <button
              onClick={analyzeFood}
              disabled={isAnalyzing}
              className="rounded-xl border border-border-custom bg-surface px-4 py-2 text-[10px] font-bold uppercase text-text-secondary transition-all hover:bg-surface-solid hover:text-primary disabled:opacity-40 cursor-pointer"
            >
              {isAnalyzing ? 'Analizuję...' : 'Analizuj'}
            </button>
          </div>

          {analyzeResult && analyzeResult.mode === 'single' && analyzeResult.fasting && (
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.03] p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🔵</span>
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Post — {analyzeResult.date}</span>
              </div>
              {analyzeResult.day_quality_analysis && (
                <p className="text-[11px] text-text-secondary">{analyzeResult.day_quality_analysis}</p>
              )}
            </div>
          )}

          {analyzeResult && analyzeResult.mode === 'single' && !analyzeResult.fasting && (
            <div className="rounded-xl border border-border-custom bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-text-muted">Jakość dnia {analyzeResult.date}</span>
                <span className={`text-lg font-black ${(analyzeResult.day_quality_score ?? 0) >= 70 ? 'text-dayC' : (analyzeResult.day_quality_score ?? 0) >= 45 ? 'text-amber-500' : 'text-dayB'}`}>
                  {analyzeResult.day_quality_score ?? 0}/100
                </span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">{analyzeResult.day_quality_analysis}</p>
              <div className="space-y-1.5 pt-1.5 border-t border-border-custom">
                {analyzeResult.items.sort((a, b) => b.food_quality_score - a.food_quality_score).map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`shrink-0 text-[10px] font-bold w-7 text-right ${item.food_quality_score >= 70 ? 'text-dayC' : item.food_quality_score >= 45 ? 'text-amber-500' : 'text-dayB'}`}>
                      {item.food_quality_score}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-text-primary truncate">{item.name}</p>
                      <p className="text-[9px] text-text-muted">{item.quality_reason}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Protein distribution by meal */}
              {(() => {
                const protDist = analyzeResult.protein_distribution;
                if (!protDist || protDist.length === 0) return null;
                return (
                  <div className="border-t border-border-custom pt-3 space-y-2">
                    <p className="text-[8px] font-bold uppercase tracking-widest text-text-muted">Białko / posiłek</p>
                    {protDist.map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[9px] font-bold w-20 shrink-0 text-text-muted capitalize truncate">{m.meal}</span>
                        <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (m.protein_g / 60) * 100)}%`,
                              backgroundColor: m.mps ? '#10b981' : m.protein_g >= 15 ? '#f59e0b' : '#f43f5e'
                            }}
                          />
                        </div>
                        <span className={`text-[9px] font-bold w-10 text-right shrink-0 ${m.mps ? 'text-dayC' : m.protein_g >= 15 ? 'text-amber-550' : 'text-dayB'}`}>
                          {m.protein_g}g
                        </span>
                      </div>
                    ))}
                    {protDist.some(m => m.note) && (
                      <p className="text-[9px] text-text-muted leading-relaxed">
                        {protDist.find(m => m.note)?.note}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {analyzeResult && analyzeResult.mode === 'range' && (
            <div className="rounded-xl border border-border-custom bg-surface p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-text-muted">Średnia {analyzeResult.dateFrom} → {analyzeResult.dateTo}</span>
                <span className={`text-lg font-black ${(analyzeResult.avg_score ?? 0) >= 70 ? 'text-dayC' : (analyzeResult.avg_score ?? 0) >= 45 ? 'text-amber-500' : 'text-dayB'}`}>
                  {analyzeResult.avg_score ?? 0}/100
                </span>
              </div>

              <div className="space-y-1.5">
                {analyzeResult.days.map(d => (
                  <div key={d.date} className={`flex items-center gap-2 ${(d.incomplete || d.fasting) ? 'opacity-50' : ''}`}>
                    <span className="w-[52px] shrink-0 text-[8px] font-bold text-text-muted">{d.date?.slice(5) ?? d.date ?? ''}</span>
                    <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: d.fasting ? '100%' : `${d.score ?? 0}%`,
                          backgroundColor: d.fasting ? '#4f46e5' : d.incomplete ? '#94a3b8' : (d.score ?? 0) >= 70 ? '#10b981' : (d.score ?? 0) >= 45 ? '#f59e0b' : '#f43f5e'
                        }}
                      />
                    </div>
                    <span className={`w-8 shrink-0 text-[9px] font-bold text-right ${d.fasting ? 'text-indigo-650' : d.incomplete ? 'text-text-muted' : (d.score ?? 0) >= 70 ? 'text-dayC' : (d.score ?? 0) >= 45 ? 'text-amber-550' : 'text-dayB'}`}>
                      {d.fasting ? '🔵' : d.incomplete ? '⚠️' : d.score ?? 0}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed border-t border-border-custom pt-3">{analyzeResult.pattern_analysis}</p>

              <div className="grid grid-cols-2 gap-3">
                {(analyzeResult.top_issues?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-dayB mb-1.5">Do poprawy</p>
                    <ul className="space-y-1">
                      {analyzeResult.top_issues?.map((t, i) => (
                        <li key={i} className="text-[9px] text-text-muted">· {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(analyzeResult.strengths?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[8px] font-bold uppercase tracking-widest text-dayC mb-1.5">Mocne strony</p>
                    <ul className="space-y-1">
                      {analyzeResult.strengths?.map((s, i) => (
                        <li key={i} className="text-[9px] text-text-muted">· {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {(analyzeResult.action_steps?.length ?? 0) > 0 && (
                <div className="border-t border-border-custom pt-3">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-primary mb-2">Co zrobić jutro</p>
                  <ol className="space-y-1.5">
                    {analyzeResult.action_steps?.map((s, i) => (
                      <li key={i} className="flex gap-2 text-[10px] text-text-secondary">
                        <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Nutrition profile + trend */}
              {(analyzeResult.nutrition_profile || analyzeResult.trend) && (
                <div className="border-t border-border-custom pt-3 space-y-2">
                  {analyzeResult.nutrition_profile && (
                    <p className="text-[10px] text-text-secondary leading-relaxed italic">{analyzeResult.nutrition_profile}</p>
                  )}
                  {analyzeResult.trend && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-bold uppercase px-2 py-1 rounded ${
                        analyzeResult.trend === 'improving' ? 'bg-dayC/10 text-dayC' :
                        analyzeResult.trend === 'degrading' ? 'bg-dayB/10 text-dayB' :
                        'bg-surface-solid/40 border border-border-custom text-text-muted'
                      }`}>
                        {analyzeResult.trend === 'improving' ? '↑ Poprawa' : analyzeResult.trend === 'degrading' ? '↓ Regres' : '→ Stabilnie'}
                      </span>
                      {analyzeResult.trend_note && (
                        <p className="text-[9px] text-text-muted flex-1">{analyzeResult.trend_note}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Best / worst day */}
              {(analyzeResult.best_day || analyzeResult.worst_day) && (
                <div className="flex gap-2">
                  {analyzeResult.best_day && (
                    <div className="flex-1 rounded-xl border border-dayC/15 bg-dayC/5 px-3 py-2">
                      <p className="text-[7px] font-bold uppercase tracking-widest text-dayC/60 mb-0.5">Najlepszy dzień</p>
                      <p className="text-[13px] font-bold text-dayC/80">{analyzeResult.best_day?.slice(5)}</p>
                    </div>
                  )}
                  {analyzeResult.worst_day && (
                    <div className="flex-1 rounded-xl border border-dayB/15 bg-dayB/5 px-3 py-2">
                      <p className="text-[7px] font-bold uppercase tracking-widest text-dayB/60 mb-0.5">Najgorszy dzień</p>
                      <p className="text-[13px] font-bold text-dayB/80">{analyzeResult.worst_day?.slice(5)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chronic gaps */}
              {(analyzeResult.chronic_gaps?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-orange-550 mb-1.5">Chroniczne braki</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analyzeResult.chronic_gaps?.map((g, i) => (
                      <span key={i} className="rounded border border-orange-500/20 bg-orange-500/5 px-2 py-0.5 text-[9px] text-orange-600 dark:text-orange-400">{g}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Training nutrition note */}
              {analyzeResult.training_nutrition_note && (
                <div className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2.5">
                  <p className="text-[8px] font-bold uppercase tracking-widest text-primary/50 mb-1">Żywienie vs trening</p>
                  <p className="text-[10px] text-text-secondary leading-relaxed">{analyzeResult.training_nutrition_note}</p>
                </div>
              )}
            </div>
          )}
        </div>

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
