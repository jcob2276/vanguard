import { notify } from '../../../lib/notify';
import { getTodayWarsaw, TIMEZONE } from '../../../lib/date';
import { mergeLatestBodyMetrics } from '../../../lib/health/bodyMetrics';
import { syncOura, syncCalendar, syncStrava, computeDailyStrain } from '../../../lib/syncApi';
import { Suspense, lazy, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import SmartAlerts from '../hero/SmartAlerts';
import DesktopHero from '../hero/DesktopHero';
import Spinner from '../../ui/Spinner';
import DesktopSectionNav from './DesktopSectionNav';
import Heatmap from '../fitness/Heatmap';
import { format, parseISO } from 'date-fns';
import SystemHealth from '../health/SystemHealth';
import { useNudgeData } from '../../core/hooks/useNudgeData';
import { loadWorkoutTemplate, markWorkoutSessionActive, purgeStaleWorkoutDraft, shouldAutoResumeWorkout, type WorkoutLoggerInitial } from '../../../lib/health/workoutLogging';
import { useDesktopData } from './useDesktopData';
import { Panel } from './Panel';
import MarathonPanel from '../fitness/MarathonPanel';
import IntelligencePanel from '../general/IntelligencePanel';
import LeniePanelMini from '../health/LeniePanelMini';
import HexagonPanel from '../general/HexagonPanel';
import FitnessScorePanel from '../fitness/FitnessScorePanel';
import HabitsPanel from '../health/HabitsPanel';
import BehaviorCapturePanel from '../general/BehaviorCapturePanel';
import SupplementsPanel from '../health/SupplementsPanel';
import DreamsPanel from '../vision/DreamsPanel';
import VisionBoardPanel from '../vision/VisionBoardPanel';
import DreamEditModal from '../vision/DreamEditModal';
import GeneralView from '../general/GeneralView';
import ScoreboardPanel from '../fitness/ScoreboardPanel';
import { useHabitsData } from '../health/useHabitsData';
import { useDreamsData } from '../vision/useDreamsData';
import type { Session } from '@supabase/supabase-js';
import { startGoogleAuth } from '../../../hooks/useSyncActions';
import {
  getSprintInfo,
  sprintMetrics,
  computeAlerts,
  daysBefore,
  weeklyVolume
} from '../desktopUtils';
import DesktopHeader from './DesktopHeader';
import DesktopBiometriaSection from './DesktopBiometriaSection';

const WorkoutLogger = lazy(() => import('../../biometrics/WorkoutLogger'));
const Fundament = lazy(() => import('../../core/Fundament'));
const MuscleHeatmap = lazy(() => import('../../biometrics/MuscleHeatmap'));
const MedicalDesktopTeaser = lazy(() => import('../../medical/MedicalDesktopTeaser'));

export default function DesktopDashboard({ session }: { session: Session }) {
  const userId      = session?.user?.id;
  const { pendingGrowthMustCount } = useNudgeData(userId);
  const { loading, oura, nutrition, sessions, body, heightCm, strain, strava, projects, moves, goals, sprintGoals, patterns, wiki, knowledge, lenieLogs, marathon, refresh } = useDesktopData(userId);

  const {
    habits, habitLogs, isAddingHabit, setIsAddingHabit,
    newHabit, setNewHabit, addHabit, deleteHabit, toggleHabit,
  } = useHabitsData({ userId });

  const {
    dreams, newDreamTitle, setNewDreamTitle, newDreamCategory, setNewDreamCategory,
    dreamFilter, setDreamFilter, isAddingDream, setIsAddingDream,
    editingDream, setEditingDream, editDreamTitle, setEditDreamTitle,
    editDreamDesc, setEditDreamDesc, editDreamCat, setEditDreamCat,
    editDreamLifeGoal, setEditDreamLifeGoal, newDreamLifeGoal, setNewDreamLifeGoal,
    savingDream, sprintReview, visionItems,
    newVisionContent, setNewVisionContent, newVisionType, setNewVisionType,
    newVisionColor, setNewVisionColor, isAddingVision, setIsAddingVision,
    addDream, toggleDream, deleteDream, toggleTop5, openDreamModal, saveDreamEdit,
    addVisionItem, deleteVisionItem,
    DREAM_CATEGORIES, DREAM_CAT_LABEL, DREAM_CAT_COLOR, VB_COLORS,
    filteredDreams, doneDreams, top5Dreams,
  } = useDreamsData({ userId, loading });

  const [syncing, setSyncing] = useState(false);
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
  const [theme, setTheme] = useState(() => localStorage.getItem('vanguard_theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('vanguard_theme', theme); } catch (e: unknown) { console.warn('[DesktopDashboard] Failed to save theme to localStorage:', e); }
  }, [theme]);

  const grid = theme === 'dark' ? '#2d3748' : '#e5e7eb';
  const tick = theme === 'dark' ? '#9ca3af' : '#6b7280';

  const syncAll = useCallback(async () => {
    if (syncing || !userId) return;
    setSyncing(true);
    try {
      const phase1 = await Promise.allSettled([
        syncOura(userId),
        syncCalendar(userId),
      ]);
      phase1.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`[sync] phase1[${i}] failed:`, r.reason);
      });
      await syncStrava().catch(e => console.error('[sync] strava failed:', e));
      await computeDailyStrain(userId, 2).catch(e => console.error('[sync] strain failed:', e));
      refresh();
    } catch (e: unknown) { notify('Synchronizacja nie powiodła się.', 'error'); console.warn('[DesktopDashboard] Synchronization failed:', e); }
    finally { setSyncing(false); }
  }, [syncing, userId, refresh]);

  const openWorkout = useCallback(async () => {
    if (!userId) { setShowWorkout(true); return; }
    markWorkoutSessionActive(userId);
    const tpl = await loadWorkoutTemplate(userId);
    setWorkoutInitial(tpl);
    setShowWorkout(true);
  }, [userId]);


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

  const oura14    = oura.slice(-14);
  const alerts    = computeAlerts(oura, sessions, nutrition);
  const mergedBodySnapshot = useMemo(() => mergeLatestBodyMetrics(body), [body]);
  const currentWeight = mergedBodySnapshot?.weight ?? null;
  const weight30ago   = currentWeight ? +([...body].reverse().find(b => (b.date ?? '') <= daysBefore(28))?.weight || 0) || null : null;

  const sprint      = getSprintInfo();
  const sprintGoal  = sprintGoals.find(g => g.personal_year === sprint.personalYear && g.sprint_number === sprint.sprintNumber) ?? null;
  const currMetrics = sprintMetrics(oura, sessions, strava, sprint.sprintStart, sprint.sprintEnd);
  const prevMetrics = sprint.prevStart ? sprintMetrics(oura, sessions, strava, sprint.prevStart, sprint.prevEnd) : null;

  const projectMetrics = {
    doneInSprint: (moves || []).filter(m => m.status === 'done' && (m.completed_at || '').slice(0, 10) >= sprint.sprintStart).length,
    inProgress: (moves || []).filter(m => m.status === 'todo' || m.status === 'open').length,
    blocked: (moves || []).filter(m => m.status === 'blocked' || ((m.status === 'todo' || m.status === 'open') && m.planned_for && m.planned_for < getTodayWarsaw())).length,
    activeProjects: (projects || []).filter(p => p.status === 'active' || (p.sense_status && p.sense_status !== 'cut' && p.sense_status !== 'completed')).length,
  };

  const sleepData = oura14.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Sen: r.total_sleep_hours ? +r.total_sleep_hours.toFixed(1) : null, HRV: r.hrv_avg || null }));
  const nutrData  = nutrition.map(r => ({ d: format(parseISO(r.date), 'dd.MM'), Kcal: r.calories || 0, Białko: r.protein || 0 }));
  const volData   = weeklyVolume(sessions);
  const now       = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE });

  if (showHealth) return (
    <div className="min-h-screen bg-background text-text-primary p-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-center gap-4">
        <button onClick={() => setShowHealth(false)} className="btn-press px-4 py-2 border border-border-custom bg-surface rounded-xl text-[12px] font-bold text-text-secondary hover:text-text-primary transition-colors cursor-pointer">← Powrót do Pulpitu</button>
      </header>
      <SystemHealth userId={userId ?? ''} />
    </div>
  );

  if (showFundament) return (
    <div className="min-h-screen bg-background text-text-primary p-8 max-w-4xl mx-auto">
      <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Spinner size="md" /></div>}>
        <Fundament session={session} onBack={() => { setShowFundament(false); refresh(); }} onSyncCalendar={startGoogleAuth} isSyncing={syncing} />
      </Suspense>
    </div>
  );

  if (showWorkout) return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Spinner size="md" /></div>}>
      <WorkoutLogger initial={workoutInitial} onSaved={() => refresh()} onBack={() => { setShowWorkout(false); setWorkoutInitial(null); refresh(); }} />
    </Suspense>
  );

  if (loading && !oura.length && !sessions.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-background text-text-primary transition-colors duration-300">
      <DesktopHeader now={now} syncing={syncing} pendingGrowthMustCount={pendingGrowthMustCount} theme={theme} setTheme={setTheme} syncAll={syncAll} setShowHealth={setShowHealth} setShowFundament={setShowFundament} />

      <main className="px-8 py-7 max-w-[1600px] mx-auto">
        <div className="flex gap-8 items-start">
          <DesktopSectionNav />
          <div className="flex-1 min-w-0 space-y-5">
            <DesktopHero strain={strain} oura={oura14} sprint={sprint} sprintGoal={sprintGoal} sprintReview={sprintReview} metrics={currMetrics} prevMetrics={prevMetrics} projectMetrics={projectMetrics} goals={goals} currentWeight={currentWeight} weight30ago={weight30ago} />
            <SmartAlerts alerts={alerts} />
            <section id="scoreboard" className="scroll-mt-28"><ScoreboardPanel userId={userId} /></section>
            <GeneralView userId={userId} oura={oura} />

            <section id="trening" className="scroll-mt-28 space-y-5">
              <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border-custom" /><span className="pixel-label">Trening</span><div className="h-px flex-1 bg-border-custom" /></div>
              <div className="space-y-5">
                <Panel title="Konsekwencja treningowa — 13 tygodni"><Heatmap sessions={sessions} strava={strava} /></Panel>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                  <FitnessScorePanel oura={oura} nutrition={nutrition} sessions={sessions} strava={strava} habits={habits} habitLogs={habitLogs} volData={volData} body={body} heightCm={heightCm} theme={theme} grid={grid} />
                  <Suspense fallback={<div className="h-[450px] animate-pulse bg-surface rounded-[24px] border border-border-custom" />}><MuscleHeatmap session={session} /></Suspense>
                </div>
              </div>
            </section>

            <DesktopBiometriaSection sleepData={sleepData} volData={volData} nutrData={nutrData} grid={grid} tick={tick} />
            <MarathonPanel strava={strava} grid={grid} tick={tick} marathon={marathon} />

            <section id="badania" className="scroll-mt-28 space-y-5">
              <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border-custom" /><span className="pixel-label">Badania i analityka</span><div className="h-px flex-1 bg-border-custom" /></div>
              <Suspense fallback={<div className="h-32 animate-pulse bg-surface rounded-[24px] border border-border-custom" />}><MedicalDesktopTeaser userId={userId} /></Suspense>
            </section>

            <section id="kierunek" className="scroll-mt-28 space-y-5">
              <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border-custom" /><span className="pixel-label">Kierunek długoterminowy</span><div className="h-px flex-1 bg-border-custom" /></div>
              <HexagonPanel userId={userId} theme={theme} grid={grid} onSaved={refresh} />
              <div className="grid grid-cols-2 gap-4">
                <LeniePanelMini logs={lenieLogs} />
                <HabitsPanel habits={habits} habitLogs={habitLogs} isAddingHabit={isAddingHabit} setIsAddingHabit={setIsAddingHabit} newHabit={newHabit} setNewHabit={setNewHabit} addHabit={addHabit} deleteHabit={deleteHabit} toggleHabit={toggleHabit} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BehaviorCapturePanel userId={userId} />
                <SupplementsPanel userId={userId} />
              </div>
              <DreamsPanel dreams={dreams} doneDreams={doneDreams} top5Dreams={top5Dreams} filteredDreams={filteredDreams} dreamFilter={dreamFilter} setDreamFilter={setDreamFilter} isAddingDream={isAddingDream} setIsAddingDream={setIsAddingDream} newDreamTitle={newDreamTitle} setNewDreamTitle={setNewDreamTitle} newDreamCategory={newDreamCategory} setNewDreamCategory={setNewDreamCategory} newDreamLifeGoal={newDreamLifeGoal} setNewDreamLifeGoal={setNewDreamLifeGoal} addDream={addDream} openDreamModal={openDreamModal} toggleDream={toggleDream} deleteDream={deleteDream} DREAM_CATEGORIES={DREAM_CATEGORIES} DREAM_CAT_LABEL={DREAM_CAT_LABEL} DREAM_CAT_COLOR={DREAM_CAT_COLOR} />
              <VisionBoardPanel visionItems={visionItems} isAddingVision={isAddingVision} setIsAddingVision={setIsAddingVision} newVisionType={newVisionType} setNewVisionType={setNewVisionType} newVisionColor={newVisionColor} setNewVisionColor={setNewVisionColor} newVisionContent={newVisionContent} setNewVisionContent={setNewVisionContent} addVisionItem={addVisionItem} deleteVisionItem={deleteVisionItem} VB_COLORS={VB_COLORS} />
            </section>

            <IntelligencePanel oura={oura} sessions={sessions} nutrition={nutrition} patterns={patterns} wiki={wiki} knowledge={knowledge} />
          </div>
        </div>
      </main>
    </div>

    <DreamEditModal editingDream={editingDream} setEditingDream={setEditingDream} editDreamTitle={editDreamTitle} setEditDreamTitle={setEditDreamTitle} editDreamCat={editDreamCat} setEditDreamCat={setEditDreamCat} editDreamLifeGoal={editDreamLifeGoal} setEditDreamLifeGoal={setEditDreamLifeGoal} editDreamDesc={editDreamDesc} setEditDreamDesc={setEditDreamDesc} saveDreamEdit={saveDreamEdit} savingDream={savingDream} toggleTop5={toggleTop5} deleteDream={deleteDream} DREAM_CATEGORIES={DREAM_CATEGORIES} DREAM_CAT_LABEL={DREAM_CAT_LABEL} />
    </>
  );
}
