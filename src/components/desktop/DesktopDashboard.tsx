import { getTodayWarsaw } from '../../lib/date';
import { Suspense, lazy, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import SmartAlerts from './SmartAlerts';
import WeeklyDigest from './WeeklyDigest';
import CockpitBanner from './CockpitBanner';
import Heatmap from './Heatmap';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import {
  RefreshCw, Dumbbell, Smartphone, Moon, Sun, CheckSquare, Square, Trash2, Plus, X,
  Fingerprint, Check, Star, Sparkles, ImageIcon, ArrowRight, Type
} from 'lucide-react';
import { createProject } from '../../lib/projects';

// Subcomponents and hooks
import { useDesktopData } from './useDesktopData';
import { Panel, Tip } from './Panel';
import MarathonPanel from './MarathonPanel';
import IntelligencePanel from './IntelligencePanel';
import LeniePanelMini from './LeniePanelMini';
import SprintPanel from './SprintPanel';

// Shared helpers and constants
import {
  C,
  getSprintInfo,
  sprintMetrics,
  computeDigest,
  computeAlerts,
  computeWeekStreak,
  daysBefore,
  weekStartDate,
  weeklyVolume
} from './desktopUtils';

const WorkoutLogger = lazy(() => import('../biometrics/WorkoutLogger'));
const Fundament = lazy(() => import('../core/Fundament'));

export default function DesktopDashboard({ session }: { session: any }) {
  const userId      = session?.user?.id;
  const accessToken = session?.access_token;
  const { oura, nutrition, sessions, body, strain, strava, projects, moves, goals, sprintGoals, patterns, wins, wiki, knowledge, lenieLogs, habits: habitsData, habitLogs: habitLogsData, refresh } = useDesktopData(userId);
  const [habits, setHabits] = useState(habitsData);
  const [habitLogs, setHabitLogs] = useState(habitLogsData);
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', icon: '✅', is_positive: true });

  useEffect(() => { setHabits(habitsData); }, [habitsData]);
  useEffect(() => { setHabitLogs(habitLogsData); }, [habitLogsData]);

  async function addHabit() {
    if (!newHabit.name.trim()) return;
    const { data, error } = await supabase.from('habits').insert({ user_id: userId, ...newHabit, name: newHabit.name.trim() }).select().single();
    if (!error) { setHabits(prev => [...prev, data]); setNewHabit({ name: '', icon: '✅', is_positive: true }); setIsAddingHabit(false); }
  }

  async function deleteHabit(id: string) {
    if (!confirm('Usunąć nawyk?')) return;
    await supabase.from('habits').delete().eq('id', id);
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  async function toggleHabit(habitId: string) {
    const today = getTodayWarsaw();
    const existing = habitLogs.find((l: any) => l.habit_id === habitId && l.date === today);
    if (existing) {
      const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
      if (!error) setHabitLogs((prev: any) => prev.filter((l: any) => l.id !== existing.id));
    } else {
      const { data, error } = await supabase.from('habit_logs').insert({ user_id: userId, habit_id: habitId, date: today, completed: true }).select().single();
      if (!error) setHabitLogs((prev: any) => [...prev, data]);
    }
  }
  // ── Dreams (Lista 200 Marzeń) ─────────────────────────────────────────────
  const [dreams, setDreams] = useState<any[]>([]);
  const [newDreamTitle, setNewDreamTitle] = useState('');
  const [newDreamCategory, setNewDreamCategory] = useState('inne');
  const [dreamFilter, setDreamFilter] = useState('all');
  const [isAddingDream, setIsAddingDream] = useState(false);
  const [editingDream, setEditingDream] = useState<any | null>(null);
  const [editDreamTitle, setEditDreamTitle] = useState('');
  const [editDreamDesc, setEditDreamDesc] = useState('');
  const [editDreamCat, setEditDreamCat] = useState('inne');
  const [editDreamLifeGoal, setEditDreamLifeGoal] = useState<string | null>(null);
  const [newDreamLifeGoal, setNewDreamLifeGoal] = useState<string | null>(null);
  const [savingDream, setSavingDream] = useState(false);

  const [visionItems, setVisionItems] = useState<any[]>([]);
  const [newVisionContent, setNewVisionContent] = useState('');
  const [newVisionType, setNewVisionType] = useState('affirmation');
  const [newVisionColor, setNewVisionColor] = useState('indigo');
  const [isAddingVision, setIsAddingVision] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('dreams').select('*').eq('user_id', userId)
      .order('is_done', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setDreams(data); });
    supabase.from('vision_board_items').select('*').eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setVisionItems(data); });
  }, [userId]);

  async function addDream() {
    if (!newDreamTitle.trim()) return;
    const { data, error } = await supabase.from('dreams')
      .insert({ user_id: userId, title: newDreamTitle.trim(), category: newDreamCategory, life_goal: newDreamLifeGoal || null } as any)
      .select().single();
    if (!error && data) { setDreams(prev => [data, ...prev]); setNewDreamTitle(''); setNewDreamLifeGoal(null); setIsAddingDream(false); }
  }

  async function toggleDream(dream: any) {
    const is_done = !dream.is_done;
    const { data, error } = await supabase.from('dreams')
      .update({ is_done, done_at: is_done ? new Date().toISOString() : null })
      .eq('id', dream.id).select().single();
    if (!error && data) setDreams(prev => prev.map(d => d.id === dream.id ? data : d));
  }

  async function deleteDream(id: string) {
    await supabase.from('dreams').delete().eq('id', id);
    setDreams(prev => prev.filter(d => d.id !== id));
    if (editingDream?.id === id) setEditingDream(null);
  }

  async function toggleTop5(dream: any) {
    const is_top5 = !dream.is_top5;
    const { data, error } = await supabase.from('dreams').update({ is_top5 }).eq('id', dream.id).select().single();
    if (!error && data) setDreams(prev => prev.map(d => d.id === dream.id ? data : d));
  }

  function openDreamModal(dream: any) {
    setEditingDream(dream);
    setEditDreamTitle(dream.title);
    setEditDreamDesc(dream.description || '');
    setEditDreamCat(dream.category);
    setEditDreamLifeGoal(dream.life_goal || null);
  }

  async function saveDreamEdit() {
    if (!editingDream) return;
    setSavingDream(true);
    const { data, error } = await supabase.from('dreams')
      .update({ title: editDreamTitle.trim(), description: editDreamDesc.trim() || null, category: editDreamCat, life_goal: editDreamLifeGoal || null } as any)
      .eq('id', editingDream.id).select().single();
    if (!error && data) {
      setDreams(prev => prev.map(d => d.id === editingDream.id ? data : d));
      setEditingDream(null);
    }
    setSavingDream(false);
  }

  async function dreamToProject(dream: any) {
    try {
      const project = (await createProject(userId!, { name: dream.title, goal: dream.description || undefined })) as any;
      if (project) {
        await supabase.from('projects').update({ dream_id: dream.id }).eq('id', project.id);
        alert(`Projekt "${dream.title}" utworzony!`);
      }
    } catch (e: any) {
      alert('Błąd: ' + e.message);
    }
  }

  async function addVisionItem() {
    if (!newVisionContent.trim()) return;
    const { data, error } = await supabase.from('vision_board_items')
      .insert({ user_id: userId, type: newVisionType, content: newVisionContent.trim(), color: newVisionColor })
      .select().single();
    if (!error && data) { setVisionItems(prev => [data, ...prev]); setNewVisionContent(''); setIsAddingVision(false); }
  }

  async function deleteVisionItem(id: string) {
    await supabase.from('vision_board_items').delete().eq('id', id);
    setVisionItems(prev => prev.filter(v => v.id !== id));
  }

  const DREAM_CATEGORIES = ['all', 'finanse', 'ciało', 'relacje', 'doświadczenia', 'wolność', 'inne'];
  const DREAM_CAT_LABEL: Record<string, string> = { all: 'Wszystkie', finanse: 'Finanse', ciało: 'Ciało', relacje: 'Relacje', doświadczenia: 'Doświadczenia', wolność: 'Wolność', inne: 'Inne' };
  const DREAM_CAT_COLOR: Record<string, string> = { finanse: 'text-emerald-500', ciało: 'text-rose-500', relacje: 'text-violet-500', doświadczenia: 'text-amber-500', wolność: 'text-sky-500', inne: 'text-text-muted' };

  const VB_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-300',  border: 'border-indigo-500/25' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/25' },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/25' },
    rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-300',    border: 'border-rose-500/25' },
    violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-500/25' },
    sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-300',     border: 'border-sky-500/25' },
  };

  const filteredDreams = dreamFilter === 'all' ? dreams : dreams.filter(d => d.category === dreamFilter);
  const doneDreams = dreams.filter(d => d.is_done).length;
  const top5Dreams = dreams.filter(d => d.is_top5 && !d.is_done).slice(0, 5);
  const projectByDreamId = useMemo(() =>
    Object.fromEntries((projects || []).filter((p: any) => p.dream_id).map((p: any) => [p.dream_id, p])),
    [projects],
  );

  const [syncing,     setSyncing]     = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [showFundament, setShowFundament] = useState(false);
  const [theme,       setTheme]       = useState(() => localStorage.getItem('vanguard_theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('vanguard_theme', theme);
  }, [theme]);

  // Hexagon state
  const [hexagonScores, setHexagonScores] = useState({
    zdrowie: 5,
    finanse: 5,
    kariera: 5,
    relacje: 5,
    rozwoj: 5,
    duchowosc: 5,
  });
  const [savingHexagon, setSavingHexagon] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchHexagon = async () => {
      try {
        const { data } = await supabase
          .from('vanguard_preferences')
          .select('key, value')
          .eq('user_id', userId)
          .eq('key', 'morning_hexagon_scores')
          .maybeSingle();
        if (data) {
          try {
            setHexagonScores(JSON.parse(data.value));
          } catch { /* malformed pref, ignore */ }
        }
      } catch (err) {
        console.error('Failed to load hexagon scores:', err);
      }
    };
    fetchHexagon();
  }, [userId]);

  const saveHexagonScores = async () => {
    if (!userId) return;
    setSavingHexagon(true);
    try {
      const today = getTodayWarsaw();
      const valStr = JSON.stringify(hexagonScores);
      
      // Save to preferences
      await supabase
        .from('vanguard_preferences')
        .upsert({ user_id: userId, key: 'morning_hexagon_scores', value: valStr, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });

      // Log change to stream
      const streamText = `[Heksagon] Zaktualizowano ocenę sfer życia: Zdrowie & Ciało: ${hexagonScores.zdrowie}/10, Finanse: ${hexagonScores.finanse}/10, Kariera & Praca: ${hexagonScores.kariera}/10, Relacje: ${hexagonScores.relacje}/10, Rozwój: ${hexagonScores.rozwoj}/10, Duchowość & Czas dla siebie: ${hexagonScores.duchowosc}/10.`;
      
      await supabase.from('vanguard_stream').insert({
        user_id: userId,
        content: streamText,
        source: 'hexagon',
        category: 'productivity',
        classification: 'hexagon_update'
      });

      alert('Zapisano oceny sfer życia w bazie! 🎯');
      refresh();
    } catch (err) {
      console.error('Failed to save hexagon scores:', err);
      alert('Błąd zapisu ocen.');
    } finally {
      setSavingHexagon(false);
    }
  };

  const grid = theme === 'dark' ? '#2d3748' : '#e5e7eb';
  const tick = theme === 'dark' ? '#9ca3af' : '#6b7280';

  const syncAll = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    const base = import.meta.env.VITE_SUPABASE_URL;
    const call = async (fn: string, b: Record<string, any> = {}) => {
      const r = await fetch(`${base}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(b),
      });
      if (!r.ok) throw new Error(fn);
    };
    try {
      await Promise.all([
        call('sync-yazio', { userId, sync_history: true, days: 7 }),
        call('sync-oura', { userId }),
        call('sync-calendar', { userId })
      ]);
      await Promise.all([call('sync-oura-enhanced', { userId, days: 2 }), call('sync-oura-timeseries', { userId, days: 2 })]);
      await call('sync-strava', {});
      await call('compute-daily-strain', { userId, days: 2 });
      refresh();
    } catch (e) { console.error('[sync]', e); }
    finally { setSyncing(false); }
  }, [syncing, accessToken, userId, refresh]);

  function startGoogleAuth() {
    const root = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: window.location.origin,
      client_id: '111163364613-nqd67ulputbk8ehbusls071g0ae4k2om.apps.googleusercontent.com',
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly'
      ].join(' ')
    };
    window.location.href = `${root}?${new URLSearchParams(options).toString()}`;
  }

  // Keyboard shortcuts: s=sync, t=trening, d=dark toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      if (e.key === 's') syncAll();
      if (e.key === 't') setShowWorkout(true);
      if (e.key === 'd') setTheme(th => th === 'light' ? 'dark' : 'light');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [syncAll]);

  // Derived
  const oura14    = oura.slice(-14);
  const latest    = oura[oura.length - 1] ?? null;
  const lastS     = [...sessions].reverse()[0] ?? null;
  const daysSince = lastS ? Math.floor((Date.now() - new Date(lastS.date + 'T12:00:00').getTime()) / 86400000) : null;
  const digest    = computeDigest(sessions, oura, strava);
  const alerts    = computeAlerts(oura, sessions, nutrition);
  const streak    = computeWeekStreak(sessions);
  const currentWeight = body.length ? +(body[body.length - 1]?.weight || 0) || null : null;
  const weight30ago   = currentWeight ? +([...body].reverse().find(b => b.date <= daysBefore(28))?.weight || 0) || null : null;

  // Sprint
  const sprint      = getSprintInfo();
  const sprintGoal  = sprintGoals.find(g => g.personal_year === sprint.personalYear && g.sprint_number === sprint.sprintNumber) ?? null;
  const currMetrics = sprintMetrics(oura, sessions, strava, sprint.sprintStart, sprint.sprintEnd);
  const prevMetrics = sprint.prevStart ? sprintMetrics(oura, sessions, strava, sprint.prevStart, sprint.prevEnd) : null;

  // Project metrics
  const ws               = weekStartDate();
  const movesDoneThisWeek = (moves||[]).filter(m => m.status === 'done' && (m.completed_at||'').slice(0,10) >= ws).length;
  const projectMetrics   = {
    doneInSprint:   (moves||[]).filter(m => m.status === 'done' && (m.completed_at||'').slice(0,10) >= sprint.sprintStart).length,
    inProgress:     (moves||[]).filter(m => m.status === 'doing').length,
    blocked:        (moves||[]).filter(m => m.status === 'blocked').length,
    activeProjects: (projects||[]).filter(p => p.sense_status !== 'cut' && p.sense_status !== 'completed').length,
  };

  const saveSprintGoal = useCallback(async (text: string) => {
    await supabase.from('sprint_goals').upsert({
      user_id: userId,
      personal_year: sprint.personalYear,
      sprint_number: sprint.sprintNumber,
      goal_text: text,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,personal_year,sprint_number' });
    refresh();
  }, [userId, sprint.personalYear, sprint.sprintNumber, refresh]);

  const sleepData = oura14.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Sen: r.total_sleep_hours ? +r.total_sleep_hours.toFixed(1) : null, HRV: r.hrv_avg || null }));
  const nutrData  = nutrition.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Kcal: r.calories || 0, Białko: r.protein || 0 }));
  const volData   = weeklyVolume(sessions);
  const now       = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });

  if (showFundament) return (
    <div className="min-h-screen bg-background text-text-primary p-8 max-w-4xl mx-auto">
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
        <Fundament session={session} onBack={() => { setShowFundament(false); refresh(); }} onSyncCalendar={startGoogleAuth} isSyncing={syncing} />
      </Suspense>
    </div>
  );

  if (showWorkout) return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
      <WorkoutLogger session={session} onBack={() => { setShowWorkout(false); refresh(); }} />
    </Suspense>
  );

  return (
    <>
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border-custom bg-background/95 backdrop-blur-md px-8 py-3.5 flex items-center gap-4">
        <div className="flex items-center gap-4">
          <span className="font-display text-[13px] font-black uppercase tracking-[0.3em] text-primary">Vanguard OS</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted hidden lg:block">{now}</span>
        </div>
        <div className="hidden xl:flex items-center gap-3 ml-4">
          {[['S','sync'], ['T','trening'], ['D','dark']].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1 text-[8px] text-text-muted">
              <kbd className="rounded border border-border-custom bg-surface px-1.5 py-0.5 font-mono text-[9px] font-black leading-none">{k}</kbd>
              <span>{l}</span>
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer">
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} className="text-yellow-400" />}
          </button>
          <button onClick={syncAll} disabled={syncing}
            className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 disabled:opacity-40 cursor-pointer">
            <RefreshCw size={14} className={syncing ? 'animate-spin text-primary' : ''} />
          </button>
          <button onClick={() => setShowFundament(true)}
            className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer"
            title="Fundament">
            <Fingerprint size={14} />
          </button>
          <button onClick={() => setShowWorkout(true)}
            className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/[0.14] transition-all active:scale-95 cursor-pointer">
            <Dumbbell size={13} /> Zaloguj trening
          </button>
          <Link to="/"
            className="flex items-center gap-1.5 rounded-full border border-border-custom px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface-solid transition-all cursor-pointer">
            <Smartphone size={12} /> Mobile
          </Link>
        </div>
      </header>

      <main className="px-8 py-7 space-y-5 max-w-[1600px] mx-auto">

        <SmartAlerts alerts={alerts} />
        <CockpitBanner strain={strain} oura={oura14} />
        <SprintPanel
          sprint={sprint}
          sprintGoal={sprintGoal}
          onSave={saveSprintGoal}
          metrics={currMetrics}
          prevMetrics={prevMetrics}
          projectMetrics={projectMetrics}
          goals={goals}
          currentWeight={currentWeight}
          weight30ago={weight30ago}
        />
        <WeeklyDigest digest={digest} movesDoneThisWeek={movesDoneThisWeek} streak={streak} />

        {/* Heatmap */}
        <Panel title="Konsekwencja treningowa — 13 tygodni">
          <Heatmap sessions={sessions} strava={strava} />
        </Panel>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-5">
          <Panel title="Sen & HRV — 14 dni">
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={sleepData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={2} />
                <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} domain={[4, 10]} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} domain={[20, 100]} />
                <Tooltip content={<Tip />} />
                <Line yAxisId="l" type="monotone" dataKey="Sen" stroke={C.indigo}  strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="r" type="monotone" dataKey="HRV" stroke={C.emerald} strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.indigo }} /> Sen (h)</span>
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.emerald }} /> HRV (ms)</span>
            </div>
          </Panel>

          <Panel title="Objętość treningowa — 10 tygodni (Mg)">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={volData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: tick }} />
                <YAxis tick={{ fontSize: 9, fill: tick }} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="vol" name="Mg" fill={C.amber} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Żywienie — 14 dni">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={nutrData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gK" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.rose} stopOpacity={0.25}/><stop offset="95%" stopColor={C.rose} stopOpacity={0}/></linearGradient>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.sky}  stopOpacity={0.25}/><stop offset="95%" stopColor={C.sky}  stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="d" tick={{ fontSize: 9, fill: tick }} interval={2} />
                <YAxis yAxisId="l" tick={{ fontSize: 9, fill: tick }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: tick }} domain={[0, 250]} />
                <Tooltip content={<Tip />} />
                <Area yAxisId="l" type="monotone" dataKey="Kcal"   stroke={C.rose} fill="url(#gK)" strokeWidth={2} dot={false} />
                <Area yAxisId="r" type="monotone" dataKey="Białko" stroke={C.sky}  fill="url(#gP)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.rose }} /> Kcal</span>
              <span className="flex items-center gap-1.5 text-[8px] text-text-muted"><span className="w-3 h-[2px] inline-block rounded" style={{ backgroundColor: C.sky  }} /> Białko (g)</span>
            </div>
          </Panel>
        </div>

        {/* Marathon */}
        <MarathonPanel strava={strava} grid={grid} tick={tick} />

        {/* Heksagon Życia */}
        <Panel title="Heksagon Życia — Koło sfer życia (Morita)">
          <div className="grid grid-cols-[1fr_380px] gap-8 items-center p-2">
            {/* Left: SVG Hexagon Radar Chart */}
            <div className="flex justify-center items-center">
              <svg width={300} height={300} className="overflow-visible">
                {/* Conic Grid lines */}
                {[2, 4, 6, 8, 10].map(k => {
                  const points = [0, 1, 2, 3, 4, 5].map(index => {
                    const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                    const radius = 110;
                    const cx = 150;
                    const cy = 150;
                    const val = k / 10;
                    return `${cx + radius * val * Math.cos(angle)},${cy + radius * val * Math.sin(angle)}`;
                  }).join(' ');
                  return (
                    <polygon
                      key={k}
                      points={points}
                      fill="none"
                      stroke={grid}
                      strokeWidth="1"
                      strokeDasharray={k === 10 ? "none" : "2,3"}
                    />
                  );
                })}

                {/* Axis lines */}
                {[0, 1, 2, 3, 4, 5].map(index => {
                  const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                  const radius = 110;
                  const cx = 150;
                  const cy = 150;
                  const x = cx + radius * Math.cos(angle);
                  const y = cy + radius * Math.sin(angle);
                  return (
                    <line
                      key={index}
                      x1={cx}
                      y1={cy}
                      x2={x}
                      y2={y}
                      stroke={grid}
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Value Polygon */}
                <polygon
                  points={[0, 1, 2, 3, 4, 5].map(index => {
                    const keys = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'];
                    const score = hexagonScores[keys[index] as keyof typeof hexagonScores] || 5;
                    const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                    const radius = 110;
                    const cx = 150;
                    const cy = 150;
                    const val = score / 10;
                    return `${cx + radius * val * Math.cos(angle)},${cy + radius * val * Math.sin(angle)}`;
                  }).join(' ')}
                  fill="rgba(79, 70, 229, 0.2)"
                  stroke="rgba(79, 70, 229, 0.85)"
                  strokeWidth="2"
                />

                {/* Value dots */}
                {[0, 1, 2, 3, 4, 5].map(index => {
                  const keys = ['zdrowie', 'finanse', 'kariera', 'relacje', 'rozwoj', 'duchowosc'];
                  const score = hexagonScores[keys[index] as keyof typeof hexagonScores] || 5;
                  const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                  const radius = 110;
                  const cx = 150;
                  const cy = 150;
                  const val = score / 10;
                  const x = cx + radius * val * Math.cos(angle);
                  const y = cy + radius * val * Math.sin(angle);
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="rgb(79, 70, 229)"
                      stroke={theme === 'dark' ? '#000' : '#fff'}
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Labels */}
                {[
                  { label: 'Zdrowie & Ciało', xOffset: 0, yOffset: -15, align: 'middle' },
                  { label: 'Finanse & Konto', xOffset: 12, yOffset: 5, align: 'start' },
                  { label: 'Kariera & Praca', xOffset: 12, yOffset: 5, align: 'start' },
                  { label: 'Relacje', xOffset: 0, yOffset: 15, align: 'middle' },
                  { label: 'Rozwój Osobisty', xOffset: -12, yOffset: 5, align: 'end' },
                  { label: 'Duchowość & Ja', xOffset: -12, yOffset: 5, align: 'end' },
                ].map((lbl, index) => {
                  const angle = index * (2 * Math.PI / 6) - (Math.PI / 2);
                  const radius = 110;
                  const cx = 150;
                  const cy = 150;
                  const x = cx + (radius + 10) * Math.cos(angle) + lbl.xOffset;
                  const y = cy + (radius + 10) * Math.sin(angle) + lbl.yOffset;
                  return (
                    <text
                      key={index}
                      x={x}
                      y={y}
                      textAnchor={lbl.align as 'start' | 'middle' | 'end'}
                      className="text-[9px] font-black uppercase tracking-wider fill-text-primary"
                    >
                      {lbl.label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Right: Sliders */}
            <div className="space-y-3.5">
              {[
                { key: 'zdrowie', label: 'Zdrowie & Ciało', desc: 'Stan organizmu, energia, nawyki zdrowotne', color: 'accent-emerald-500' },
                { key: 'finanse', label: 'Finanse & Konto', desc: 'Zarabianie, oszczędności, inwestycje', color: 'accent-amber-500' },
                { key: 'kariera', label: 'Kariera & Praca', desc: 'Cele zawodowe, skuteczność, głęboka praca', color: 'accent-indigo-500' },
                { key: 'relacje', label: 'Relacje', desc: 'Jakość kontaktu z bliskimi, brak samotności', color: 'accent-pink-500' },
                { key: 'rozwoj', label: 'Rozwój Osobisty', desc: 'Nowe umiejętności, 1% lepszy każdego dnia', color: 'accent-sky-500' },
                { key: 'duchowosc', label: 'Duchowość & Czas dla siebie', desc: 'Spokój wewnętrzny, medytacja, obecność', color: 'accent-violet-500' },
              ].map(item => (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-text-primary">{item.label}</span>
                    <span className="font-black text-primary font-display">{hexagonScores[item.key as keyof typeof hexagonScores] || 5}/10</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={hexagonScores[item.key as keyof typeof hexagonScores] || 5}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        setHexagonScores(prev => ({ ...prev, [item.key]: val }));
                      }}
                      className={`w-full h-1 bg-border-custom rounded-lg appearance-none cursor-pointer ${item.color}`}
                    />
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <button
                  onClick={saveHexagonScores}
                  disabled={savingHexagon}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-primary-hover active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingHexagon ? 'Zapisywanie...' : 'Zapisz oceny sfer życia 🎯'}
                </button>
              </div>
            </div>
          </div>
        </Panel>

        {/* Lenie + Nawyki side by side */}
        <div className="grid grid-cols-2 gap-4">
          <LeniePanelMini logs={lenieLogs} userId={userId} accessToken={accessToken} />
          <div className="rounded-[20px] border border-border-custom bg-surface/60 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Nawyki</p>
              <button onClick={() => setIsAddingHabit(p => !p)} className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-primary border border-primary/20 bg-primary/5 px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-all cursor-pointer">
                <Plus size={10} /> Dodaj
              </button>
            </div>
            {isAddingHabit && (
              <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-black uppercase tracking-widest text-text-primary">Nowy sygnał</p>
                  <button onClick={() => setIsAddingHabit(false)} className="text-text-muted hover:text-text-primary"><X size={13} /></button>
                </div>
                <div className="grid grid-cols-[44px_1fr] gap-2">
                  <input value={newHabit.icon} onChange={e => setNewHabit(p => ({ ...p, icon: e.target.value }))} className="rounded-lg border border-border-custom bg-surface p-2 text-center text-[13px] font-black text-text-primary outline-none focus:border-primary/50" placeholder="✅" />
                  <input value={newHabit.name} onChange={e => setNewHabit(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addHabit()} className="rounded-lg border border-border-custom bg-surface px-3 py-2 text-[11px] font-bold text-text-primary outline-none placeholder:text-text-muted/40 focus:border-primary/50" placeholder="Nazwa" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setNewHabit(p => ({ ...p, is_positive: true }))} className={`rounded-lg border py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer ${newHabit.is_positive ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400' : 'border-border-custom text-text-muted'}`}>Wzmacniać</button>
                  <button onClick={() => setNewHabit(p => ({ ...p, is_positive: false }))} className={`rounded-lg border py-2 text-[8px] font-black uppercase tracking-widest cursor-pointer ${!newHabit.is_positive ? 'border-rose-500/35 bg-rose-500/10 text-rose-400' : 'border-border-custom text-text-muted'}`}>Unikać</button>
                </div>
                <button onClick={addHabit} className="w-full rounded-lg bg-primary py-2 text-[9px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">Dodaj</button>
              </div>
            )}
            <div className="space-y-2">
              {habits.map(habit => {
                const today = getTodayWarsaw();
                const doneToday = habitLogs.some(l => l.habit_id === habit.id && l.date === today);
                return (
                  <div key={habit.id} className="rounded-[14px] border border-border-custom bg-surface p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[14px] shrink-0">{habit.icon || '✅'}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-black uppercase text-text-primary">{habit.name}</p>
                          <p className="text-[7px] font-bold uppercase tracking-widest text-text-muted">{habit.is_positive ? 'wzmacniać' : 'unikać'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleHabit(habit.id)} className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors cursor-pointer ${doneToday ? (habit.is_positive ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-rose-500 bg-rose-500 text-white') : 'border-border-custom text-text-muted hover:text-text-primary'}`}>
                          {doneToday ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        <button onClick={() => deleteHabit(habit.id)} className="p-1.5 text-text-muted/40 hover:text-rose-500 rounded-lg cursor-pointer"><Trash2 size={11} /></button>
                      </div>
                    </div>
                    <div className="flex h-2 gap-0.5 overflow-hidden">
                      {Array.from({ length: 30 }).map((_, i) => {
                        const d = subDays(new Date(), 29 - i).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
                        const has = habitLogs.some(l => l.habit_id === habit.id && l.date === d);
                        const ok = habit.is_positive ? has : !has;
                        return <div key={d} className={`flex-1 rounded-sm ${d === today && !has ? 'border border-border-custom' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />;
                      })}
                    </div>
                  </div>
                );
              })}
              {habits.length === 0 && <p className="text-[9px] text-text-muted/50 text-center py-3">Brak nawyków — dodaj pierwszy</p>}
            </div>
          </div>
        </div>

        {/* Lista 200 Marzeń */}
        <Panel title="">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Lista Marzeń</p>
                <p className="mt-0.5 font-display text-[15px] font-black tracking-tight text-text-primary leading-none">
                  200 Marzeń
                  <span className="ml-2 text-[11px] font-bold text-text-muted">
                    {doneDreams > 0 ? `${doneDreams} zrealizowanych` : `${dreams.length} zapisanych`}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setIsAddingDream(p => !p)}
                className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
              >
                <Plus size={11} /> Dodaj marzenie
              </button>
            </div>

            {/* Add form */}
            {isAddingDream && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3.5 space-y-2.5">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newDreamTitle}
                    onChange={e => setNewDreamTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addDream()}
                    placeholder="Wpisz marzenie..."
                    className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
                  />
                  <select
                    value={newDreamCategory}
                    onChange={e => setNewDreamCategory(e.target.value)}
                    className="rounded-xl border border-border-custom bg-surface px-3 py-2 text-[11px] font-bold text-text-secondary outline-none focus:border-primary cursor-pointer"
                  >
                    {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                      <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
                    ))}
                  </select>
                  <button onClick={addDream} className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">
                    Dodaj
                  </button>
                  <button onClick={() => setIsAddingDream(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Cel:</span>
                  {([['cialo', 'Ciało', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'], ['duch', 'Duch', 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500'], ['konto', 'Konto', 'border-amber-500/40 bg-amber-500/10 text-amber-600']] as [string, string, string][]).map(([val, label, active]) => (
                    <button key={val} onClick={() => setNewDreamLifeGoal(newDreamLifeGoal === val ? null : val)}
                      className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${newDreamLifeGoal === val ? active : 'border-border-custom text-text-muted hover:text-text-secondary'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top 5 Marzeń */}
            {top5Dreams.length > 0 && (
              <div className="space-y-2">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-500 flex items-center gap-1.5">
                  <Star size={9} fill="currentColor" /> Top 5 Marzeń
                </p>
                <div className="space-y-1.5">
                  {top5Dreams.map(dream => (
                    <div key={dream.id} className="flex items-center gap-2.5 rounded-[14px] border border-amber-500/20 bg-amber-500/[0.04] px-3.5 py-2.5">
                      <Star size={10} className="shrink-0 text-amber-500" fill="currentColor" />
                      <button onClick={() => openDreamModal(dream)} className="flex-1 text-left text-[11px] font-bold text-text-primary hover:text-primary truncate cursor-pointer">
                        {dream.title}
                      </button>
                      {dream.description && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary/40" title="Ma wizję" />}
                      <span className={`text-[7px] font-black uppercase tracking-widest shrink-0 ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>{dream.category}</span>
                      {projectByDreamId[dream.id] ? (
                        <span className="shrink-0 flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary/70">
                          <ArrowRight size={9} /> {projectByDreamId[dream.id].name}
                        </span>
                      ) : (
                        <button
                          onClick={() => dreamToProject(dream)}
                          className="shrink-0 flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
                        >
                          <ArrowRight size={9} /> Projekt
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-border-custom" />
              </div>
            )}

            {/* Category filter */}
            <div className="flex gap-1.5 flex-wrap">
              {DREAM_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setDreamFilter(cat)}
                  className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    dreamFilter === cat
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border-custom text-text-muted hover:border-text-secondary hover:text-text-secondary'
                  }`}
                >
                  {DREAM_CAT_LABEL[cat]}
                  {cat !== 'all' && dreams.filter(d => d.category === cat).length > 0 && (
                    <span className="ml-1 opacity-60">{dreams.filter(d => d.category === cat).length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Dreams list */}
            {filteredDreams.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-text-muted/50">
                {dreams.length === 0 ? 'Zacznij od zapisania pierwszego marzenia' : 'Brak marzeń w tej kategorii'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredDreams.map(dream => (
                  <div
                    key={dream.id}
                    onClick={() => openDreamModal(dream)}
                    className={`group flex items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5 transition-all cursor-pointer ${
                      dream.is_done
                        ? 'border-emerald-500/15 bg-emerald-500/[0.04] opacity-60'
                        : dream.is_top5
                        ? 'border-amber-500/15 bg-amber-500/[0.02] hover:border-amber-500/30'
                        : 'border-border-custom bg-surface hover:border-primary/20'
                    }`}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); toggleDream(dream); }}
                      className={`shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                        dream.is_done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-border-custom hover:border-primary'
                      }`}
                    >
                      {dream.is_done && <Check size={9} strokeWidth={3} />}
                    </button>
                    <p className={`flex-1 text-[11px] font-semibold leading-snug min-w-0 truncate ${dream.is_done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {dream.title}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {dream.is_top5 && !dream.is_done && <Star size={8} className="text-amber-500" fill="currentColor" />}
                      {dream.description && <span className="w-1 h-1 rounded-full bg-primary/40" />}
                      {projectByDreamId[dream.id] && (
                        <span className="text-[7px] font-black uppercase tracking-widest text-primary/60 border border-primary/20 rounded px-1 py-0.5">
                          proj
                        </span>
                      )}
                      <span className={`text-[7px] font-black uppercase tracking-widest ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>
                        {dream.category}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); deleteDream(dream.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {dreams.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border-custom">
                <div className="flex justify-between text-[8px] font-bold text-text-muted uppercase tracking-widest">
                  <span>{doneDreams} zrealizowanych</span>
                  <span>{dreams.length} / 200</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-border-custom overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min((dreams.length / 200) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Vision Board */}
        <Panel title="">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Wizualizacja</p>
                <p className="mt-0.5 font-display text-[15px] font-black tracking-tight text-text-primary leading-none">
                  Vision Board
                  <span className="ml-2 text-[11px] font-bold text-text-muted">{visionItems.length} elementów</span>
                </p>
              </div>
              <button
                onClick={() => setIsAddingVision(p => !p)}
                className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
              >
                <Plus size={11} /> Dodaj
              </button>
            </div>

            {/* Add form */}
            {isAddingVision && (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3.5 space-y-2.5">
                {/* Type selector */}
                <div className="flex gap-1.5">
                  {[
                    { v: 'affirmation', label: 'Afirmacja', icon: <Sparkles size={10} /> },
                    { v: 'image',       label: 'Obraz (URL)', icon: <ImageIcon size={10} /> },
                    { v: 'word',        label: 'Słowo',    icon: <Type size={10} /> },
                  ].map(({ v, label, icon }) => (
                    <button
                      key={v}
                      onClick={() => setNewVisionType(v)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        newVisionType === v ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border-custom text-text-muted hover:text-text-secondary'
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
                {/* Color selector */}
                <div className="flex gap-1.5 items-center">
                  <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Kolor:</span>
                  {Object.keys(VB_COLORS).map(c => (
                    <button
                      key={c}
                      onClick={() => setNewVisionColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${VB_COLORS[c].bg} ${newVisionColor === c ? 'border-primary scale-125' : 'border-transparent hover:scale-110'}`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newVisionContent}
                    onChange={e => setNewVisionContent(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addVisionItem()}
                    placeholder={newVisionType === 'image' ? 'URL obrazka...' : newVisionType === 'word' ? 'Jedno słowo...' : 'Afirmacja: Jestem...'}
                    className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
                  />
                  <button onClick={addVisionItem} className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">
                    Dodaj
                  </button>
                  <button onClick={() => setIsAddingVision(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Board grid */}
            {visionItems.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Sparkles size={20} className="mx-auto text-text-muted/30" />
                <p className="text-[11px] text-text-muted/50">Dodaj afirmacje, obrazy i słowa które cię inspirują</p>
              </div>
            ) : (
              <div className="columns-2 gap-2 space-y-0">
                {visionItems.map(item => {
                  const c = VB_COLORS[item.color] || VB_COLORS.indigo;
                  return (
                    <div key={item.id} className="group relative break-inside-avoid mb-2">
                      {item.type === 'image' ? (
                        <div className="relative overflow-hidden rounded-[14px] border border-border-custom bg-surface">
                          <img
                            src={item.content}
                            alt=""
                            className="w-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <button
                            onClick={() => deleteVisionItem(item.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-all cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : item.type === 'word' ? (
                        <div className={`relative flex items-center justify-center rounded-[14px] border ${c.border} ${c.bg} px-4 py-5`}>
                          <p className={`font-display text-[22px] font-black tracking-tight ${c.text} text-center`}>{item.content}</p>
                          <button
                            onClick={() => deleteVisionItem(item.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className={`relative rounded-[14px] border ${c.border} ${c.bg} px-3.5 py-4`}>
                          <p className={`text-[12px] font-bold leading-snug ${c.text}`}>{item.content}</p>
                          <button
                            onClick={() => deleteVisionItem(item.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* Intelligence — conclusions, not data */}
        <IntelligencePanel
          oura={oura} sessions={sessions} nutrition={nutrition} wins={wins}
          patterns={patterns} wiki={wiki} knowledge={knowledge}
        />

      </main>
    </div>

    {/* Dream edit modal */}
    {editingDream && createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
        onClick={() => setEditingDream(null)}
      >
        <div
          className="w-full max-w-lg rounded-[24px] border border-border-custom bg-surface p-6 shadow-2xl space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              <h2 className="font-display text-[15px] font-black text-text-primary">Pogłęb wizję</h2>
            </div>
            <button onClick={() => setEditingDream(null)} className="text-text-muted hover:text-text-primary cursor-pointer transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Marzenie</label>
            <input
              value={editDreamTitle}
              onChange={e => setEditDreamTitle(e.target.value)}
              className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm font-semibold text-text-primary outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5 flex-1">
              <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Kategoria</label>
              <select
                value={editDreamCat}
                onChange={e => setEditDreamCat(e.target.value)}
                className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary cursor-pointer"
              >
                {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">Cel życiowy</label>
              <div className="flex gap-1.5">
                {([['cialo', 'Ciało', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'], ['duch', 'Duch', 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500'], ['konto', 'Konto', 'border-amber-500/40 bg-amber-500/10 text-amber-600']] as [string, string, string][]).map(([val, label, active]) => (
                  <button key={val} onClick={() => setEditDreamLifeGoal(editDreamLifeGoal === val ? null : val)}
                    className={`rounded-xl border px-3 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${editDreamLifeGoal === val ? active : 'border-border-custom text-text-muted hover:text-text-secondary'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[8px] font-black uppercase tracking-[0.2em] text-text-muted">
              Wizja — jak się czujesz gdy to osiągasz?
            </label>
            <textarea
              value={editDreamDesc}
              onChange={e => setEditDreamDesc(e.target.value)}
              placeholder="Opisz jak to wygląda, jak się czujesz, co widzisz, słyszysz, czujesz w tym momencie..."
              rows={5}
              className="w-full rounded-xl border border-border-custom bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-primary resize-none placeholder:text-text-muted/40"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={saveDreamEdit}
              disabled={savingDream || !editDreamTitle.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-40"
            >
              <Check size={11} strokeWidth={2.5} /> Zapisz wizję
            </button>
            <button
              onClick={() => { toggleTop5(editingDream); setEditingDream((prev: any) => prev ? { ...prev, is_top5: !prev.is_top5 } : null); }}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                editingDream.is_top5
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                  : 'border-border-custom text-text-muted hover:border-amber-500/30 hover:text-amber-500'
              }`}
            >
              <Star size={11} fill={editingDream.is_top5 ? 'currentColor' : 'none'} />
              Top 5
            </button>
            <button
              onClick={() => { deleteDream(editingDream.id); }}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 text-rose-400/50 hover:text-rose-500 hover:border-rose-500/30 transition-all cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
