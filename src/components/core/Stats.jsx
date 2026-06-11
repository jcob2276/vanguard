import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, Trash2, Scale, Ruler, Activity, Zap, CheckSquare } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

import { useStore } from '../../store/useStore';
import { calculateProjection, generateNarrative } from './stats/statsCalculations.js';
import { analyzeFoodQuality, analyzeTrainingLoad as requestTrainingLoad, syncYazioHistory } from './stats/statsApi.js';
import { TrendArrow } from './stats/TrendArrow.jsx';

export default function Stats({ session, topSlot = null, runningSlot = null }) {
  const { userSettings } = useStore();
  const [loading, setLoading] = useState(true);
  const [bodyData, setBodyData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [newMetric, setNewMetric] = useState({ weight: '', waist: '' });
  const [nutritionData, setNutritionData] = useState([]);
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
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [editForm, setEditForm] = useState({ date: '', logs: [] });
  const [trends, setTrends] = useState({});
  const [projections, setProjections] = useState(null);
  const [narrative, setNarrative] = useState('');
  const [isAnalyzingTraining, setIsAnalyzingTraining] = useState(false);
  const [trainingAnalysis, setTrainingAnalysis] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: body },
        { data: sessions },
        { data: oura },
        { data: nutrition }
      ] = await Promise.all([
        supabase.from('body_metrics').select('*').eq('user_id', session.user.id).order('date', { ascending: true }),
        supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', session.user.id).order('date', { ascending: false }),
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60),
        supabase.from('daily_nutrition').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60)
      ]);

      if (body) setBodyData(body);
      
      if (nutrition) {
        setNutritionData([...nutrition].reverse().map(n => ({
          date: format(parseISO(n.date), 'dd.MM'),
          protein: n.protein,
          calories: n.calories
        })));
      }

      if (sessions) {
        setRecentSessions(sessions.map(s => ({
          ...s,
          duration: s.start_time && s.end_time ? Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000) : '--'
        })));
      }

      // Calculate Trends
      const newTrends = {};
      const ouraRaw = oura || [];
      const nutrRaw = nutrition || [];
      
      if (body && body.length >= 2) {
        newTrends.weight = { cur: body[body.length - 1].weight, prev: body[body.length - 2].weight };
        newTrends.waist = { cur: body[body.length - 1].waist, prev: body[body.length - 2].waist };
      }
      if (ouraRaw.length >= 2) {
        // oura was reversed for trend, but let's use the raw data which was ordered desc
        newTrends.readiness = { cur: ouraRaw[0].readiness_score, prev: ouraRaw[1].readiness_score };
        newTrends.sleep = { cur: ouraRaw[0].total_sleep_hours, prev: ouraRaw[1].total_sleep_hours };
      }
      if (nutrRaw.length >= 2) {
        newTrends.protein = { cur: nutrRaw[0].protein, prev: nutrRaw[1].protein };
      }
      setTrends(newTrends);

      // Calculate Projections (6 weeks)
      if (body && body.length >= 3) {
        setProjections({
          weight: calculateProjection(body, 'weight'),
          waist: calculateProjection(body, 'waist')
        });
      }

      setNarrative(generateNarrative(body, ouraRaw, sessions));
    } catch (err) {
      console.error('Fetch Stats Error:', err);
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function saveMetrics(e) {
    e.preventDefault();
    const today = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Warsaw' }).format(new Date());
    const payload = {
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

  async function deleteSession(id) {
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
      alert('B????d po????czenia: ' + err.message);
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
      else throw new Error(res.error || 'Nieznany b????d');
    } catch (err) {
      alert('B????d analizy treningu: ' + err.message);
    } finally {
      setIsAnalyzingTraining(false);
    }
  }

  async function startEditing(session) {
    setEditingSession(session.id);
    setEditForm({
      date: session.date,
      logs: session.exercise_logs.map(log => ({ ...log }))
    });
  }

  async function updateSession() {
    try {
      // 1. Update session date
      const { error: sessionError } = await supabase
        .from('workout_sessions')
        .update({ date: editForm.date })
        .eq('id', editingSession);
      if (sessionError) throw sessionError;
      
      // 2. Update all logs
      for (const log of editForm.logs) {
        const weight = log.weight === '' || log.weight == null ? null : parseFloat(log.weight);
        const reps = log.reps === '' || log.reps == null ? null : parseInt(log.reps, 10);
        if ((weight != null && Number.isNaN(weight)) || (reps != null && Number.isNaN(reps))) {
          throw new Error('Nieprawidłowa wartość w serii.');
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
  async function deleteLog(id) {
    if (confirm('Usunąć tę serię?')) {
      await supabase.from('exercise_logs').delete().eq('id', id);
      setEditForm({ ...editForm, logs: editForm.logs.filter(l => l.id !== id) });
    }
  }

  async function exportData() {
    setIsExporting(true);
    try {
      const { exportStatsMarkdown } = await import('./stats/exportStats.js');
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
    } finally {
      setIsExporting(false);
    }
  }

  async function exportOuraCSV() {
    setIsExportingOura(true);
    try {
      const { exportOuraCsv } = await import('./stats/exportStats.js');
      await exportOuraCsv({ supabase, session, dateRange });
    } finally {
      setIsExportingOura(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-neutral-500 uppercase font-black animate-pulse tracking-widest">Wczytywanie...</div>;

  const isSunday = new Date().getDay() === 0;
  const latestBody = bodyData?.[bodyData.length - 1] || null;
  const todayStr = format(new Date(), 'dd.MM');
  const isLatestToday = nutritionData.length > 0 && nutritionData[nutritionData.length - 1].date === todayStr;
  const todayProtein = isLatestToday ? Number(nutritionData[nutritionData.length - 1].protein || 0) : 0;
  const proteinGoal = 150;
  const proteinPct = Math.min((todayProtein / proteinGoal) * 100, 100);
  
  let recentProtein = [...nutritionData];
  if (recentProtein.length > 0 && recentProtein[recentProtein.length - 1].date !== todayStr) {
    recentProtein.push({
      date: todayStr,
      protein: 0,
      calories: 0
    });
  }
  recentProtein = recentProtein.slice(-7);

  return (
    <div className="space-y-6 pb-4">
      {/* Raport Psychologiczny - Tylko w Niedzielę */}
      {narrative && isSunday && (
        <section className="animate-in fade-in zoom-in duration-700">
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary">
              <Zap size={12} className="text-primary" /> Analiza Behawioralna
            </h3>
            <p className="text-[13px] font-bold leading-relaxed text-white/78">"{narrative}"</p>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-primary">Pomiary</p>
            <h2 className="mt-1 text-[18px] font-black uppercase tracking-tight text-white">Waga i talia</h2>
          </div>
          <Activity className="text-primary/35" size={22} />
        </header>
        <div className="space-y-4 rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(10,10,11,0.96))] p-5 shadow-2xl shadow-black/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center text-[8px] font-black uppercase tracking-widest text-white/35">
                Waga (kg) <TrendArrow current={trends.weight?.cur} previous={trends.weight?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.weight} onChange={e => setNewMetric({...newMetric, weight: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-lg font-black text-white outline-none transition-all placeholder:text-white/16 focus:border-primary/70 focus:bg-black/65" placeholder={latestBody?.weight ? String(latestBody.weight) : '--'} />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center text-[8px] font-black uppercase tracking-widest text-white/35">
                Talia (cm) <TrendArrow current={trends.waist?.cur} previous={trends.waist?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.waist} onChange={e => setNewMetric({...newMetric, waist: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-lg font-black text-white outline-none transition-all placeholder:text-white/16 focus:border-primary/70 focus:bg-black/65" placeholder={latestBody?.waist ? String(latestBody.waist) : '--'} />
            </div>
          </div>
          <button onClick={saveMetrics} className="w-full rounded-lg bg-primary py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]">Zapisz pomiary</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/[0.07] bg-neutral-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/32">Waga</p>
            <Scale size={13} className="text-white/24" />
          </div>
          <p className="text-[20px] font-black text-white">{latestBody?.weight ?? '--'}<span className="ml-1 text-[10px] text-white/25">kg</span></p>
          {projections?.weight && <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/25">6w: {projections.weight.value} kg</p>}
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-neutral-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/32">Talia</p>
            <Ruler size={13} className="text-white/24" />
          </div>
          <p className="text-[20px] font-black text-white">{latestBody?.waist ?? '--'}<span className="ml-1 text-[10px] text-white/25">cm</span></p>
          {projections?.waist && <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/25">6w: {projections.waist.value} cm</p>}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-white/[0.08] bg-neutral-950/80 p-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Eksport</p>
          <h2 className="mt-1 text-[15px] font-black uppercase tracking-tight text-white">Raport danych</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-primary transition-colors" size={14} />
            <input
              type="date"
              value={dateRange.from}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              onChange={e => setDateRange({...dateRange, from: e.target.value})}
              className="w-full cursor-pointer appearance-none rounded-lg border border-white/[0.08] bg-black/35 p-3 pl-10 text-[10px] font-bold text-white outline-none transition-all focus:border-primary/70"
            />
          </div>
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-primary transition-colors" size={14} />
            <input
              type="date"
              value={dateRange.to}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              onChange={e => setDateRange({...dateRange, to: e.target.value})}
              className="w-full cursor-pointer appearance-none rounded-lg border border-white/[0.08] bg-black/35 p-3 pl-10 text-[10px] font-bold text-white outline-none transition-all focus:border-primary/70"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button onClick={() => setIncludeWorkouts(!includeWorkouts)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeWorkouts ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeWorkouts && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Trening (Siłka/Strava)</span>
          </button>

          <button onClick={() => setIncludeBody(!includeBody)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeBody ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeBody && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Pomiary Ciała</span>
          </button>

          <button onClick={() => setIncludeYazio(!includeYazio)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeYazio ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeYazio && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Dieta (Yazio)</span>
          </button>

          <button onClick={() => setIncludeJournal(!includeJournal)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeJournal ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeJournal && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Notatnik (Telegram)</span>
          </button>

          <button onClick={() => setIncludeOura(!includeOura)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeOura ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeOura && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Oura Ring</span>
          </button>

          <button onClick={() => setIncludeHabits(!includeHabits)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeHabits ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeHabits && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Nawyki</span>
          </button>

          <button onClick={() => setIncludeActivityWatch(!includeActivityWatch)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeActivityWatch ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeActivityWatch && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Aktywność komputera (ActivityWatch)</span>
          </button>

        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={syncHistory} disabled={isSyncing} className="text-[8px] font-black uppercase text-neutral-600 hover:text-primary transition-colors">
            {isSyncing ? 'Syncing...' : 'Sync Yazio'}
          </button>
          <button onClick={exportData} disabled={isExporting} className="ml-4 flex-1 rounded-lg bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-transform hover:scale-[1.01]">
            {isExporting ? 'Generowanie...' : 'Pobierz Raport (.md)'}
          </button>
        </div>

        <div className="border-t border-white/[0.06] pt-1 space-y-3">
          <div className="flex gap-1">
            {[1, 7, 14, 30].map(p => (
              <button
                key={p}
                onClick={() => { setAnalyzePeriod(p); setAnalyzeResult(null); }}
                className={`flex-1 rounded-lg border py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${analyzePeriod === p ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.02] text-white/35 hover:text-white/60'}`}
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
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase text-white/60 focus:outline-none focus:border-primary/40"
              />
            )}
            {analyzePeriod > 1 && (
              <p className="flex-1 text-[10px] font-black uppercase text-white/30">
                Ostatnie {analyzePeriod} dni
              </p>
            )}
            <button
              onClick={analyzeFood}
              disabled={isAnalyzing}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase text-white/60 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
            >
              {isAnalyzing ? 'Analizuję...' : 'Analizuj'}
            </button>
          </div>

          {analyzeResult && analyzeResult.mode === 'single' && analyzeResult.fasting && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🔵</span>
                <span className="text-[10px] font-black uppercase text-blue-400">Post — {analyzeResult.date}</span>
              </div>
              {analyzeResult.day_quality_analysis && (
                <p className="text-[11px] text-white/50">{analyzeResult.day_quality_analysis}</p>
              )}
            </div>
          )}

          {analyzeResult && analyzeResult.mode === 'single' && !analyzeResult.fasting && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-white/40">Jakość dnia {analyzeResult.date}</span>
                <span className={`text-lg font-black ${analyzeResult.day_quality_score >= 70 ? 'text-dayC' : analyzeResult.day_quality_score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                  {analyzeResult.day_quality_score}/100
                </span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">{analyzeResult.day_quality_analysis}</p>
              <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                {analyzeResult.items.sort((a, b) => b.food_quality_score - a.food_quality_score).map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`shrink-0 text-[10px] font-black w-7 text-right ${item.food_quality_score >= 70 ? 'text-dayC' : item.food_quality_score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                      {item.food_quality_score}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white/80 truncate">{item.name}</p>
                      <p className="text-[9px] text-white/35">{item.quality_reason}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Protein distribution by meal */}
              {analyzeResult.protein_distribution?.length > 0 && (
                <div className="border-t border-white/[0.06] pt-3 space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Białko / posiłek</p>
                  {analyzeResult.protein_distribution.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[9px] font-black w-20 shrink-0 text-white/35 capitalize truncate">{m.meal}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (m.protein_g / 60) * 100)}%`,
                            backgroundColor: m.mps ? '#10b981' : m.protein_g >= 15 ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                      <span className={`text-[9px] font-black w-10 text-right shrink-0 ${m.mps ? 'text-dayC' : m.protein_g >= 15 ? 'text-yellow-400' : 'text-dayB'}`}>
                        {m.protein_g}g
                      </span>
                    </div>
                  ))}
                  {analyzeResult.protein_distribution.some(m => m.note) && (
                    <p className="text-[9px] text-white/30 leading-relaxed">
                      {analyzeResult.protein_distribution.find(m => m.note)?.note}
                    </p>
                  )}
                </div>
              )}

              {/* Training sync */}
              {analyzeResult.training_sync && (
                <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-primary/60 mb-1">Sync z treningiem</p>
                  <p className="text-[10px] text-white/55 leading-relaxed">{analyzeResult.training_sync}</p>
                </div>
              )}

              {/* Micronutrient gaps */}
              {analyzeResult.micronutrient_gaps?.length > 0 && (
                <div className="border-t border-white/[0.06] pt-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-orange-400/70 mb-2">Potencjalne braki</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analyzeResult.micronutrient_gaps.map((gap, i) => (
                      <span key={i} className="rounded border border-orange-400/20 bg-orange-400/5 px-2 py-0.5 text-[9px] text-orange-300/70">{gap}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Swap suggestions */}
              {analyzeResult.swap_suggestions?.length > 0 && (
                <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Zamiany</p>
                  {analyzeResult.swap_suggestions.map((s, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className="text-[9px] font-black text-dayB/70 line-through">{s.from}</span>
                        <span className="text-[8px] text-white/25">→</span>
                        <span className="text-[9px] font-black text-dayC/80">{s.to}</span>
                      </div>
                      {s.reason && <p className="text-[9px] text-white/35">{s.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {analyzeResult && analyzeResult.mode === 'range' && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-white/40">Średnia {analyzeResult.dateFrom} → {analyzeResult.dateTo}</span>
                <span className={`text-lg font-black ${analyzeResult.avg_score >= 70 ? 'text-dayC' : analyzeResult.avg_score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                  {analyzeResult.avg_score}/100
                </span>
              </div>

              <div className="space-y-1.5">
                {analyzeResult.days.map(d => (
                  <div key={d.date} className={`flex items-center gap-2 ${(d.incomplete || d.fasting) ? 'opacity-50' : ''}`}>
                    <span className="w-[52px] shrink-0 text-[8px] font-black text-white/30">{d.date?.slice(5) ?? d.date ?? ''}</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: d.fasting ? '100%' : `${d.score}%`,
                          backgroundColor: d.fasting ? '#3b82f6' : d.incomplete ? '#6b7280' : d.score >= 70 ? '#10b981' : d.score >= 45 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                    <span className={`w-8 shrink-0 text-[9px] font-black text-right ${d.fasting ? 'text-blue-400' : d.incomplete ? 'text-white/25' : d.score >= 70 ? 'text-dayC' : d.score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                      {d.fasting ? '🔵' : d.incomplete ? '⚠️' : d.score}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-white/60 leading-relaxed border-t border-white/[0.06] pt-3">{analyzeResult.pattern_analysis}</p>

              <div className="grid grid-cols-2 gap-3">
                {analyzeResult.top_issues?.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-dayB mb-1.5">Do poprawy</p>
                    <ul className="space-y-1">
                      {analyzeResult.top_issues.map((t, i) => (
                        <li key={i} className="text-[9px] text-white/50">· {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analyzeResult.strengths?.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-dayC mb-1.5">Mocne strony</p>
                    <ul className="space-y-1">
                      {analyzeResult.strengths.map((s, i) => (
                        <li key={i} className="text-[9px] text-white/50">· {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {analyzeResult.action_steps?.length > 0 && (
                <div className="border-t border-white/[0.06] pt-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-primary mb-2">Co zrobić jutro</p>
                  <ol className="space-y-1.5">
                    {analyzeResult.action_steps.map((s, i) => (
                      <li key={i} className="flex gap-2 text-[10px] text-white/70">
                        <span className="font-black text-primary shrink-0">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Nutrition profile + trend */}
              {(analyzeResult.nutrition_profile || analyzeResult.trend) && (
                <div className="border-t border-white/[0.06] pt-3 space-y-2">
                  {analyzeResult.nutrition_profile && (
                    <p className="text-[10px] text-white/45 leading-relaxed italic">{analyzeResult.nutrition_profile}</p>
                  )}
                  {analyzeResult.trend && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${
                        analyzeResult.trend === 'improving' ? 'bg-dayC/10 text-dayC' :
                        analyzeResult.trend === 'degrading' ? 'bg-dayB/10 text-dayB' :
                        'bg-white/5 text-white/40'
                      }`}>
                        {analyzeResult.trend === 'improving' ? '↑ Poprawa' : analyzeResult.trend === 'degrading' ? '↓ Regres' : '→ Stabilnie'}
                      </span>
                      {analyzeResult.trend_note && (
                        <p className="text-[9px] text-white/35 flex-1">{analyzeResult.trend_note}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Best / worst day */}
              {(analyzeResult.best_day || analyzeResult.worst_day) && (
                <div className="flex gap-2">
                  {analyzeResult.best_day && (
                    <div className="flex-1 rounded-lg border border-dayC/15 bg-dayC/5 px-3 py-2">
                      <p className="text-[7px] font-black uppercase tracking-widest text-dayC/60 mb-0.5">Najlepszy dzień</p>
                      <p className="text-[13px] font-black text-dayC/80">{analyzeResult.best_day?.slice(5)}</p>
                    </div>
                  )}
                  {analyzeResult.worst_day && (
                    <div className="flex-1 rounded-lg border border-dayB/15 bg-dayB/5 px-3 py-2">
                      <p className="text-[7px] font-black uppercase tracking-widest text-dayB/60 mb-0.5">Najgorszy dzień</p>
                      <p className="text-[13px] font-black text-dayB/80">{analyzeResult.worst_day?.slice(5)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chronic gaps */}
              {analyzeResult.chronic_gaps?.length > 0 && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-orange-400/60 mb-1.5">Chroniczne braki</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analyzeResult.chronic_gaps.map((g, i) => (
                      <span key={i} className="rounded border border-orange-400/15 bg-orange-400/5 px-2 py-0.5 text-[9px] text-orange-300/60">{g}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Training nutrition note */}
              {analyzeResult.training_nutrition_note && (
                <div className="rounded-lg border border-primary/10 bg-primary/5 px-3 py-2.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-primary/50 mb-1">Żywienie vs trening</p>
                  <p className="text-[10px] text-white/50 leading-relaxed">{analyzeResult.training_nutrition_note}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={exportOuraCSV} disabled={isExportingOura} className="w-full rounded-lg border border-white/[0.08] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white/45 transition-colors hover:border-primary/40 hover:text-primary">
          {isExportingOura ? 'Generowanie...' : 'Pobierz Oura (.csv)'}
        </button>

      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Fueling</p>
            <h2 className="mt-1 text-[16px] font-black uppercase tracking-tight text-white">Białko dzisiaj</h2>
          </div>
          <p className="text-[13px] font-black text-primary">{todayProtein}g</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Cel {proteinGoal}g</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{Math.round(proteinPct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(59,130,246,0.35)]" style={{ width: `${proteinPct}%` }} />
          </div>
          {recentProtein.length > 0 && (
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {recentProtein.map((d) => {
                const pct = Math.min((Number(d.protein || 0) / proteinGoal) * 100, 100);
                return (
                  <div key={d.date} className="flex h-14 flex-col justify-end gap-1">
                    <div className="rounded-sm bg-primary/70" style={{ height: `${Math.max(pct, 6)}%` }} />
                    <span className="text-center text-[7px] font-bold text-white/25">{d.date.slice(0, 2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {topSlot}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-black uppercase tracking-tight text-white">Trener AI</h2>
          <button
            onClick={analyzeTrainingLoad}
            disabled={isAnalyzingTraining}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase text-white/60 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            {isAnalyzingTraining ? 'Analizuję...' : '7 dni vs norma'}
          </button>
        </div>

        {trainingAnalysis && (() => {
          const r = trainingAnalysis;
          const s = r.stats || {};
          const loadColor = r.load_status === 'elevated' ? 'text-orange-400 border-orange-400/30 bg-orange-400/8' : r.load_status === 'optimal' ? 'text-dayC border-dayC/30 bg-dayC/8' : 'text-white/40 border-white/15 bg-white/4';
          const loadLabel = r.load_status === 'elevated' ? 'Przeciążenie' : r.load_status === 'optimal' ? 'Optymalne' : 'Za mało';
          const recovColor = r.recovery_status === 'deficit' ? 'text-dayB border-dayB/30 bg-dayB/8' : r.recovery_status === 'ok' ? 'text-dayC border-dayC/30 bg-dayC/8' : 'text-white/40 border-white/15 bg-white/4';
          const recovLabel = r.recovery_status === 'deficit' ? 'Deficyt' : r.recovery_status === 'ok' ? 'Regeneracja OK' : 'Nadregeneracja';

          const StatRow = ({ label, week, base, unit = '', higherBetter = true }) => {
            if (week == null && base == null) return null;
            const pctVal = (base && base > 0) ? ((week - base) / base * 100) : null;
            const up = pctVal != null && pctVal > 0;
            const neutral = pctVal == null || Math.abs(pctVal) < 3;
            const good = neutral ? null : (higherBetter ? up : !up);
            return (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="w-20 shrink-0 text-white/35 font-black uppercase text-[8px] tracking-widest">{label}</span>
                <span className="font-black text-white">{week ?? '—'}{unit}</span>
                {pctVal != null && (
                  <span className={`text-[9px] font-bold ${good === null ? 'text-white/30' : good ? 'text-dayC' : 'text-dayB'}`}>
                    {pctVal > 0 ? '+' : ''}{pctVal.toFixed(0)}%
                  </span>
                )}
                <span className="text-white/20 text-[9px]">norma {base ?? '—'}{unit}</span>
              </div>
            );
          };

          const injuryColor = r.injury_risk?.level === 'high' ? 'border-dayB/30 bg-dayB/8 text-dayB' : r.injury_risk?.level === 'moderate' ? 'border-orange-400/30 bg-orange-400/8 text-orange-400' : 'border-white/[0.07] bg-white/[0.02] text-white/40';

          return (
            <div className="space-y-3">
              {/* Status badges */}
              <div className="flex gap-2 flex-wrap">
                <span className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${loadColor}`}>{loadLabel}</span>
                <span className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${recovColor}`}>{recovLabel}</span>
                {r.injury_risk?.level && r.injury_risk.level !== 'low' && (
                  <span className={`rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${injuryColor}`}>
                    {r.injury_risk.level === 'high' ? '⚠ Ryzyko kontuzji' : '△ Uwaga'}
                  </span>
                )}
              </div>

              {/* Stats comparison — 7 dni vs średnia 3 poprzednich tygodni */}
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 space-y-2">
                {s.km_trend && (
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-[8px] font-black uppercase text-white/25 w-20 shrink-0">Km/tydz</span>
                    <div className="flex items-end gap-1 h-6">
                      {s.km_trend.map((v, i) => {
                        const maxV = Math.max(...s.km_trend.filter(Boolean), 1);
                        const h = Math.max(2, Math.round((v / maxV) * 20));
                        return <div key={i} style={{height: h}} className={`w-4 rounded-sm ${i === 3 ? 'bg-primary/70' : 'bg-white/15'}`} title={`${v}km`} />;
                      })}
                    </div>
                    <span className="text-[9px] text-white/40">{s.km_trend?.join(' → ')} km</span>
                  </div>
                )}
                <StatRow label="Strain" week={s.week_strain} base={s.base_strain} higherBetter={false} />
                <StatRow label="Readiness" week={s.week_recovery} base={s.base_recovery} />
                <StatRow label="HRV" week={s.week_hrv} base={s.base_hrv} unit="ms" />
                <StatRow label="Sen" week={s.week_sleep} base={s.base_sleep} unit="h" />
                <StatRow label="Siłownia" week={s.week_sets} base={s.base_sets_pw} unit=" ser" />
                <StatRow label="Bieganie" week={s.week_run_km} base={s.base_run_km_pw} unit="km" />
                <StatRow label="Sauna" week={s.week_sauna} base={s.base_sauna_pw} unit="x" />
                {s.hr_max && (
                  <p className="text-[9px] text-white/20 pt-1 border-t border-white/[0.04]">HRmax (28d): {s.hr_max} BPM | Z2 &lt; {s.z2_ceiling} BPM</p>
                )}
              </div>

              {/* Summaries */}
              <div className="space-y-1.5">
                {r.load_summary && <p className="text-[11px] text-white/65 leading-relaxed">{r.load_summary}</p>}
                {r.recovery_summary && <p className="text-[11px] text-white/65 leading-relaxed">{r.recovery_summary}</p>}
                {r.training_trajectory && (
                  <p className="text-[11px] text-white/50 leading-relaxed italic">{r.training_trajectory}</p>
                )}
                {r.marathon_readiness && (
                  <p className="text-[11px] text-primary/70 leading-relaxed border-l-2 border-primary/30 pl-2">{r.marathon_readiness}</p>
                )}
              </div>

              {/* Injury risk */}
              {r.injury_risk && (r.injury_risk.flags?.length > 0 || r.injury_risk.prevention) && (
                <div className={`rounded-lg border p-3 space-y-1.5 ${injuryColor}`}>
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-70">Ryzyko kontuzji</p>
                  {r.injury_risk.flags?.map((f, i) => (
                    <p key={i} className="text-[10px] leading-snug opacity-80">• {f}</p>
                  ))}
                  {r.injury_risk.prevention && (
                    <p className="text-[9px] opacity-60 pt-0.5">{r.injury_risk.prevention}</p>
                  )}
                </div>
              )}

              {/* Strength prescription */}
              {r.strength_prescription?.exercises?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Następna siłownia</p>
                  {r.strength_prescription.focus && (
                    <p className="text-[10px] text-white/45 leading-relaxed">{r.strength_prescription.focus}</p>
                  )}
                  <div className="space-y-1.5">
                    {r.strength_prescription.exercises.map((ex, i) => (
                      <div key={i} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 flex items-start gap-3">
                        <div className="shrink-0 w-5 h-5 rounded bg-primary/15 flex items-center justify-center mt-0.5">
                          <span className="text-[8px] font-black text-primary/70">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-black text-white/85">{ex.name}</span>
                            <span className="text-[9px] font-black text-primary/80 bg-primary/10 rounded px-1.5 py-0.5">{ex.sets_reps}</span>
                            {ex.load && <span className="text-[9px] font-black text-white/60 bg-white/5 rounded px-1.5 py-0.5">{ex.load}</span>}
                          </div>
                          {ex.note && <p className="text-[9px] text-white/35 mt-0.5 leading-snug">{ex.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Muscle gaps */}
              {r.missing_muscles?.length > 0 && (
                <div className="rounded-lg border border-orange-400/15 bg-orange-400/5 p-3">
                  <p className="text-[8px] font-black uppercase tracking-widest text-orange-400/70 mb-1.5">Brakujące partie</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.missing_muscles.map((m, i) => (
                      <span key={i} className="rounded border border-orange-400/25 bg-orange-400/8 px-2 py-0.5 text-[9px] font-bold text-orange-300/80">{m}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key insights */}
              {r.key_insights?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Wnioski</p>
                  {r.key_insights.map((insight, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <span className="shrink-0 text-[8px] font-black text-white/20 mt-0.5">{i + 1}</span>
                      <p className="text-[11px] text-white/60 leading-relaxed">{insight}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Strength + sauna notes */}
              {(r.strength_note || r.sauna_note) && (
                <div className="space-y-1 pt-1 border-t border-white/[0.05]">
                  {r.strength_note && <p className="text-[10px] text-white/40">{r.strength_note}</p>}
                  {r.sauna_note && <p className="text-[10px] text-white/40">{r.sauna_note}</p>}
                </div>
              )}

              {/* Recommendations */}
              {r.recommendations?.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[8px] font-black uppercase tracking-widest text-white/25">Rekomendacje</p>
                  {r.recommendations.map((rec, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 flex gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-black text-primary/80">{rec.priority}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white/80">{rec.action}</p>
                        <p className="text-[9px] text-white/35 mt-0.5">{rec.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </section>

      <section className="space-y-3">
        <h2 className="text-[16px] font-black uppercase tracking-tight text-white">Historia treningów</h2>
        <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-neutral-950/60">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.03] text-[8px] font-black uppercase tracking-widest text-white/30">
                <th className="p-3">Data</th>
                <th className="p-3 text-center">Dzień</th>
                <th className="p-3 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-[10px] font-bold text-white">
              {recentSessions.slice(0, showAllSessions ? 12 : 4).map(s => (
                <tr key={s.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="p-3">
                    {editingSession === s.id ? (
                      <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="bg-neutral-950 border border-neutral-800 rounded p-1 text-[10px] text-white" />
                    ) : (
                      format(parseISO(s.date), 'dd.MM')
                    )}
                  </td>
                  <td className="p-3 text-center text-white/45">
                    {editingSession === s.id ? (
                      <div className="space-y-2 text-left">
                        {editForm.logs.map((log, idx) => (
                          <div key={log.id} className="flex items-center gap-2 bg-neutral-950 p-2 rounded border border-neutral-800">
                            <span className="text-[8px] w-12 truncate">{log.exercise_name}</span>
                            <input type="number" step="0.5" value={log.weight} onChange={e => {
                              const newLogs = [...editForm.logs];
                              newLogs[idx].weight = e.target.value;
                              setEditForm({...editForm, logs: newLogs});
                            }} className="w-12 bg-neutral-900 border border-neutral-800 rounded p-1 text-[10px]" />
                            <span className="text-[8px]">kg x</span>
                            <input type="number" value={log.reps} onChange={e => {
                              const newLogs = [...editForm.logs];
                              newLogs[idx].reps = e.target.value;
                              setEditForm({...editForm, logs: newLogs});
                            }} className="w-10 bg-neutral-900 border border-neutral-800 rounded p-1 text-[10px]" />
                            <button onClick={() => deleteLog(log.id)} className="text-red-900 hover:text-red-500 ml-auto"><Trash2 size={10} /></button>
                          </div>
                        ))}
                        <button onClick={updateSession} className="w-full bg-primary text-white py-2 rounded text-[8px] font-black uppercase">Zapisz Zmiany</button>
                        <button onClick={() => setEditingSession(null)} className="w-full text-neutral-500 py-1 text-[8px] font-black uppercase">Anuluj</button>
                      </div>
                    ) : (
                      s.workout_day
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {editingSession !== s.id && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEditing(s)} className="text-neutral-700 hover:text-primary p-2"><Zap size={12} /></button>
                        <button onClick={() => deleteSession(s.id)} className="text-neutral-700 hover:text-red-500 p-2"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentSessions.length > 4 && (
            <button
              onClick={() => setShowAllSessions(v => !v)}
              className="w-full py-2.5 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors border-t border-white/[0.05]"
            >
              {showAllSessions ? 'Zwiń ↑' : `Pokaż więcej (${recentSessions.length - 4}) ↓`}
            </button>
          )}
        </div>
      </section>

      {runningSlot}
    </div>
  );
}
