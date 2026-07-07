import { getTodayWarsaw } from '../../lib/date';
import { mergeLatestBodyMetrics } from '../../lib/bodyMetrics';
import { NETWORK_TIMEOUT_MS } from '../../lib/constants';
import { Suspense, lazy, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import SmartAlerts from './SmartAlerts';
import DesktopHero from './DesktopHero';
import DesktopSectionNav from './DesktopSectionNav';
import Heatmap from './Heatmap';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import {
  RefreshCw, Smartphone, Moon, Sun, Fingerprint, ShieldCheck,
} from 'lucide-react';
import DashboardModuleShortcuts from '../core/DashboardModuleShortcuts';
import SystemHealth from './SystemHealth';
import { useNudgeData } from '../../hooks/useNudgeData';
import { loadWorkoutTemplate, markWorkoutSessionActive, purgeStaleWorkoutDraft, shouldAutoResumeWorkout, type WorkoutLoggerInitial } from '../../lib/workoutLogging';
import { useDesktopData } from './useDesktopData';
import { Panel, Tip } from './Panel';
import MarathonPanel from './MarathonPanel';
import IntelligencePanel from './IntelligencePanel';
import LeniePanelMini from './LeniePanelMini';
import HexagonPanel from './HexagonPanel';
import FitnessScorePanel from './FitnessScorePanel';
import HabitsPanel from './HabitsPanel';
import BehaviorCapturePanel from './BehaviorCapturePanel';
import SupplementsPanel from './SupplementsPanel';
import DreamsPanel from './DreamsPanel';
import VisionBoardPanel from './VisionBoardPanel';
import DreamEditModal from './DreamEditModal';
import GeneralView from './GeneralView';
import ScoreboardPanel from './ScoreboardPanel';
import { useHabitsData } from './useHabitsData';
import { useDreamsData } from './useDreamsData';
import { Session } from '@supabase/supabase-js';

import {
  C,
  getSprintInfo,
  sprintMetrics,
  computeAlerts,
  daysBefore,
  weeklyVolume
} from './desktopUtils';

const WorkoutLogger = lazy(() => import('../biometrics/WorkoutLogger'));
const Fundament = lazy(() => import('../core/Fundament'));
const MuscleHeatmap = lazy(() => import('../biometrics/MuscleHeatmap'));
const MedicalDesktopTeaser = lazy(() => import('../medical/MedicalDesktopTeaser'));

export default function DesktopDashboard({ session }: { session: Session }) {
  const userId      = session?.user?.id;
  const accessToken = session?.access_token;
  const { pendingGrowthMustCount } = useNudgeData(userId);
  const { loading, oura, nutrition, sessions, body, heightCm, strain, strava, projects, moves, goals, sprintGoals, patterns, wins, wiki, knowledge, lenieLogs, habits: habitsData, habitLogs: habitLogsData, refresh } = useDesktopData(userId);

  const {
    habits,
    habitLogs,
    isAddingHabit,
    setIsAddingHabit,
    newHabit,
    setNewHabit,
    addHabit,
    deleteHabit,
    toggleHabit,
  } = useHabitsData({ userId, habitsData, habitLogsData });

  const {
    dreams,
    newDreamTitle, setNewDreamTitle,
    newDreamCategory, setNewDreamCategory,
    dreamFilter, setDreamFilter,
    isAddingDream, setIsAddingDream,
    editingDream, setEditingDream,
    editDreamTitle, setEditDreamTitle,
    editDreamDesc, setEditDreamDesc,
    editDreamCat, setEditDreamCat,
    editDreamLifeGoal, setEditDreamLifeGoal,
    newDreamLifeGoal, setNewDreamLifeGoal,
    savingDream,
    sprintReview,
    visionItems,
    newVisionContent, setNewVisionContent,
    newVisionType, setNewVisionType,
    newVisionColor, setNewVisionColor,
    isAddingVision, setIsAddingVision,
    addDream,
    toggleDream,
    deleteDream,
    toggleTop5,
    openDreamModal,
    saveDreamEdit,
    addVisionItem,
    deleteVisionItem,
    DREAM_CATEGORIES,
    DREAM_CAT_LABEL,
    DREAM_CAT_COLOR,
    VB_COLORS,
    filteredDreams,
    doneDreams,
    top5Dreams
  } = useDreamsData({ userId, loading });

  const [syncing,     setSyncing]     = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [workoutInitial, setWorkoutInitial] = useState<WorkoutLoggerInitial | null>(null);
  const resumedWorkoutDraft = useRef(false);

  useEffect(() => {
    if (resumedWorkoutDraft.current || !userId) return;
    resumedWorkoutDraft.current = true;
    purgeStaleWorkoutDraft(userId);
    if (shouldAutoResumeWorkout(userId)) {
      markWorkoutSessionActive(userId);
      setTimeout(() => setShowWorkout(true), 0);
    }
  }, [userId]);
  const [showFundament, setShowFundament] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [theme,       setTheme]       = useState(() => localStorage.getItem('vanguard_theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('vanguard_theme', theme); } catch (e: unknown) {
      console.error('[Background Error]', e);
    }
  }, [theme]);

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
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(fn);
    };
    try {
      // sync-oura runs enhanced + timeseries internally — one call, one ring
      const phase1 = await Promise.allSettled([
        call('sync-oura', { userId }),
        call('sync-calendar', { userId })
      ]);
      phase1.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`[sync] phase1[${i}] failed:`, r.reason);
      });
      await call('sync-strava', {}).catch(e => console.error('[sync] strava failed:', e));
      await call('compute-daily-strain', { userId, days: 2 }).catch(e => console.error('[sync] strain failed:', e));
      refresh();
    } catch (e: unknown) {
      console.error('[Background Error]', e);
    }
    finally { setSyncing(false); }
  }, [syncing, accessToken, userId, refresh]);

  const openWorkout = useCallback(async () => {
    if (!userId) {
      setShowWorkout(true);
      return;
    }
    markWorkoutSessionActive(userId);
    const tpl = await loadWorkoutTemplate(userId);
    setWorkoutInitial(tpl);
    setShowWorkout(true);
  }, [userId]);

  function startGoogleAuth() {
    const root = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: window.location.origin,
      client_id: '111163364613-nqd67ulputbk8ehbusls071g0ae4k2om.apps.googleusercontent.com',
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.events'
      ].join(' ')
    };
    window.location.assign(`${root}?${new URLSearchParams(options).toString()}`);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      if (e.key === 's') syncAll();
      if (e.key === 't') void openWorkout();
      if (e.key === 'd') setTheme(th => th === 'light' ? 'dark' : 'light');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [syncAll, openWorkout]);

  // Derived
  const oura14    = oura.slice(-14);
  const latest    = oura[oura.length - 1] ?? null;
  const lastS     = [...sessions].reverse()[0] ?? null;
  const daysSince = lastS ? Math.round((new Date(getTodayWarsaw() + 'T12:00:00Z').getTime() - new Date(lastS.date + 'T12:00:00Z').getTime()) / 86400000) : null;
  const alerts    = computeAlerts(oura, sessions, nutrition);
  const mergedBodySnapshot = useMemo(() => mergeLatestBodyMetrics(body), [body]);
  const currentWeight = mergedBodySnapshot?.weight ?? null;
  const weight30ago   = currentWeight ? +([...body].reverse().find(b => b.date <= daysBefore(28))?.weight || 0) || null : null;

  // Sprint
  const sprint      = getSprintInfo();
  const sprintGoal  = sprintGoals.find(g => g.personal_year === sprint.personalYear && g.sprint_number === sprint.sprintNumber) ?? null;
  const currMetrics = sprintMetrics(oura, sessions, strava, sprint.sprintStart, sprint.sprintEnd);
  const prevMetrics = sprint.prevStart ? sprintMetrics(oura, sessions, strava, sprint.prevStart, sprint.prevEnd) : null;

  const projectMetrics   = {
    doneInSprint: (moves || []).filter(
      (m) => m.status === 'done' && (m.completed_at || '').slice(0, 10) >= sprint.sprintStart,
    ).length,
    inProgress: (moves || []).filter((m) => m.status === 'todo' || m.status === 'open').length,
    blocked: (moves || []).filter(
      (m) =>
        m.status === 'blocked'
        || ((m.status === 'todo' || m.status === 'open') && m.planned_for && m.planned_for < getTodayWarsaw()),
    ).length,
    activeProjects: (projects || []).filter(
      (p) => p.status === 'active' || (p.sense_status && p.sense_status !== 'cut' && p.sense_status !== 'completed'),
    ).length,
  };

  const sleepData = oura14.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Sen: r.total_sleep_hours ? +r.total_sleep_hours.toFixed(1) : null, HRV: r.hrv_avg || null }));
  const nutrData  = nutrition.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Kcal: r.calories || 0, Białko: r.protein || 0 }));
  const volData   = weeklyVolume(sessions);
  const now       = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });

  if (showHealth) return (
    <div className="min-h-screen bg-background text-text-primary p-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-center gap-4">
        <button
          onClick={() => setShowHealth(false)}
          className="btn-press px-4 py-2 border border-border-custom bg-surface rounded-xl text-[12px] font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          ← Powrót do Pulpitu
        </button>
      </header>
      <SystemHealth userId={userId ?? ''} />
    </div>
  );

  if (showFundament) return (
    <div className="min-h-screen bg-background text-text-primary p-8 max-w-4xl mx-auto">
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
        <Fundament session={session} onBack={() => { setShowFundament(false); refresh(); }} onSyncCalendar={startGoogleAuth} isSyncing={syncing} />
      </Suspense>
    </div>
  );

  if (showWorkout) return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>}>
      <WorkoutLogger
        session={session}
        initial={workoutInitial}
        onSaved={() => refresh()}
        onBack={() => { setShowWorkout(false); setWorkoutInitial(null); refresh(); }}
      />
    </Suspense>
  );

  if (loading && !oura.length && !sessions.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

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
          <DashboardModuleShortcuts naukaBadge={pendingGrowthMustCount} />
          <button onClick={() => setShowHealth(true)}
            className="rounded-full border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary hover:text-text-primary transition-all active:scale-95 cursor-pointer flex items-center justify-center"
            title="Status zdrowia systemu"
          >
            <ShieldCheck size={14} />
          </button>
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
          <Link to="/"
            className="flex items-center gap-1.5 rounded-full border border-border-custom px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface-solid transition-all cursor-pointer">
            <Smartphone size={12} /> Mobile
          </Link>
        </div>
      </header>

      <main className="px-8 py-7 max-w-[1600px] mx-auto">
        <div className="flex gap-8 items-start">
          <DesktopSectionNav />
          <div className="flex-1 min-w-0 space-y-5">

        <DesktopHero
          strain={strain}
          oura={oura14}
          sprint={sprint}
          sprintGoal={sprintGoal}
          sprintReview={sprintReview}
          metrics={currMetrics}
          prevMetrics={prevMetrics}
          projectMetrics={projectMetrics}
          goals={goals}
          currentWeight={currentWeight}
          weight30ago={weight30ago}
        />

        <SmartAlerts alerts={alerts} />

        <section id="scoreboard" className="scroll-mt-28">
          <ScoreboardPanel userId={userId} />
        </section>

        <GeneralView userId={userId} oura={oura} />

        <section id="trening" className="scroll-mt-28 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-custom" />
            <span className="pixel-label">Trening</span>
            <div className="h-px flex-1 bg-border-custom" />
          </div>
        <div className="space-y-5">
          <Panel title="Konsekwencja treningowa — 13 tygodni">
            <Heatmap sessions={sessions} strava={strava} />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
            <FitnessScorePanel
              oura={oura}
              nutrition={nutrition}
              sessions={sessions}
              strava={strava}
              habits={habits}
              habitLogs={habitLogs}
              volData={volData}
              body={body}
              heightCm={heightCm}
              theme={theme}
              grid={grid}
            />
            <Suspense fallback={<div className="h-[450px] animate-pulse bg-surface rounded-[24px] border border-border-custom" />}>
              <MuscleHeatmap session={session} />
            </Suspense>
          </div>
        </div>
        </section>

        <section id="biometria" className="scroll-mt-28 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-custom" />
            <span className="pixel-label">Biometria & paliwo</span>
            <div className="h-px flex-1 bg-border-custom" />
          </div>
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

        <MarathonPanel strava={strava} grid={grid} tick={tick} />
        </section>

        <section id="badania" className="scroll-mt-28 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-custom" />
            <span className="pixel-label">Badania i analityka</span>
            <div className="h-px flex-1 bg-border-custom" />
          </div>
          <Suspense fallback={<div className="h-32 animate-pulse bg-surface rounded-[24px] border border-border-custom" />}>
            <MedicalDesktopTeaser userId={userId} />
          </Suspense>
        </section>

        <section id="kierunek" className="scroll-mt-28 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-custom" />
            <span className="pixel-label">Kierunek długoterminowy</span>
            <div className="h-px flex-1 bg-border-custom" />
          </div>

        <HexagonPanel userId={userId} theme={theme} grid={grid} onSaved={refresh} />

        <div className="grid grid-cols-2 gap-4">
          <LeniePanelMini logs={lenieLogs} userId={userId} accessToken={accessToken} />
          <HabitsPanel
            habits={habits}
            habitLogs={habitLogs}
            isAddingHabit={isAddingHabit}
            setIsAddingHabit={setIsAddingHabit}
            newHabit={newHabit}
            setNewHabit={setNewHabit}
            addHabit={addHabit}
            deleteHabit={deleteHabit}
            toggleHabit={toggleHabit}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BehaviorCapturePanel userId={userId} />
          <SupplementsPanel userId={userId} />
        </div>

        <DreamsPanel
          dreams={dreams}
          doneDreams={doneDreams}
          top5Dreams={top5Dreams}
          filteredDreams={filteredDreams}
          dreamFilter={dreamFilter}
          setDreamFilter={setDreamFilter}
          isAddingDream={isAddingDream}
          setIsAddingDream={setIsAddingDream}
          newDreamTitle={newDreamTitle}
          setNewDreamTitle={setNewDreamTitle}
          newDreamCategory={newDreamCategory}
          setNewDreamCategory={setNewDreamCategory}
          newDreamLifeGoal={newDreamLifeGoal}
          setNewDreamLifeGoal={setNewDreamLifeGoal}
          addDream={addDream}
          openDreamModal={openDreamModal}
          toggleDream={toggleDream}
          deleteDream={deleteDream}
          DREAM_CATEGORIES={DREAM_CATEGORIES}
          DREAM_CAT_LABEL={DREAM_CAT_LABEL}
          DREAM_CAT_COLOR={DREAM_CAT_COLOR}
        />

        <VisionBoardPanel
          visionItems={visionItems}
          isAddingVision={isAddingVision}
          setIsAddingVision={setIsAddingVision}
          newVisionType={newVisionType}
          setNewVisionType={setNewVisionType}
          newVisionColor={newVisionColor}
          setNewVisionColor={setNewVisionColor}
          newVisionContent={newVisionContent}
          setNewVisionContent={setNewVisionContent}
          addVisionItem={addVisionItem}
          deleteVisionItem={deleteVisionItem}
          VB_COLORS={VB_COLORS}
        />
        </section>

        <IntelligencePanel
          oura={oura} sessions={sessions} nutrition={nutrition} wins={wins}
          patterns={patterns} wiki={wiki} knowledge={knowledge}
        />

          </div>
        </div>
      </main>
    </div>

    <DreamEditModal
      editingDream={editingDream}
      setEditingDream={setEditingDream}
      editDreamTitle={editDreamTitle}
      setEditDreamTitle={setEditDreamTitle}
      editDreamCat={editDreamCat}
      setEditDreamCat={setEditDreamCat}
      editDreamLifeGoal={editDreamLifeGoal}
      setEditDreamLifeGoal={setEditDreamLifeGoal}
      editDreamDesc={editDreamDesc}
      setEditDreamDesc={setEditDreamDesc}
      saveDreamEdit={saveDreamEdit}
      savingDream={savingDream}
      toggleTop5={toggleTop5}
      deleteDream={deleteDream}
      DREAM_CATEGORIES={DREAM_CATEGORIES}
      DREAM_CAT_LABEL={DREAM_CAT_LABEL}
    />
    </>
  );
}
