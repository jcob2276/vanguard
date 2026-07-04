import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  FolderKanban,
  CheckSquare,
  Clock,
  LayoutDashboard,
  Moon,
  Sun,
  StickyNote,
  Bookmark,
  Sparkles,
  Activity,
  Plus,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ErrorBoundary } from './ErrorBoundary';
import { useDashboardData } from '../../hooks/useDashboardData';
import { getTodayWarsaw } from '../../lib/date';
import { useHaptics } from '../../hooks/useHaptics';
import { useNudgeData } from '../../hooks/useNudgeData';
import { useSyncActions } from '../../hooks/useSyncActions';
import PowerList from '../lifestyle/PowerList';
import OrientationFooter from './OrientationFooter';
import { SpineGuideStrip } from './SpineGuideStrip';
import { useSpineGuidance } from '../../hooks/useSpineGuidance';
import type { SpineGuideTarget } from '../../lib/goalSpineGuide';
import NutritionCard from './NutritionCard';
import NutritionTrainingBarCard from './nutrition/NutritionTrainingBarCard';
import FoodQuickCapture from './nutrition/FoodQuickCapture';
import TrainingSaunaQuickBar from '../biometrics/TrainingSaunaQuickBar';
import { markWorkoutSessionActive, purgeStaleWorkoutDraft, shouldAutoResumeWorkout, type WorkoutLoggerInitial } from '../../lib/workoutLogging';
import FoodEntryModal from './nutrition/FoodEntryModal';
import MorningPlanModal from './MorningPlanModal';
import DailyShutdownModal from './DailyShutdownModal';
import WeeklyReviewModal from '../todo/WeeklyReviewModal';
import { fetchLatestTaskReviewDate } from '../../lib/todo';
import { getWeekStartWarsaw } from '../../lib/growth';

const WorkoutLogger = lazy(() => import('../biometrics/WorkoutLogger'));
const SaunaLoggerModal = lazy(() => import('../biometrics/SaunaLoggerModal'));
const Stats = lazy(() => import('./Stats'));
const Fundament = lazy(() => import('./Fundament'));
const DailyStrainCard = lazy(() => import('../biometrics/DailyStrainCard'));
const StravaWidget = lazy(() => import('../integrations/StravaWidget'));
const Photos = lazy(() => import('../identity/Photos'));
const Direction = lazy(() => import('../lifestyle/Direction'));
const Projects = lazy(() => import('../projects/Projects'));
const Todo = lazy(() => import('../todo/Todo'));
const LinksInbox = lazy(() => import('../lifestyle/LinksInbox'));
const Keep = lazy(() => import('../notes/Keep'));
const CalendarView = lazy(() => import('../calendar/CalendarView'));

import { BrandTitle } from '../ui/BrandTitle';
import { PersonaAvatarButton } from '../ui/PersonaAvatarButton';
import { ActionCenterSheet, usePendingActionCount } from '../shared/ActionCenterSheet';
const InsightsDashboard = lazy(() => import('../insights/InsightsDashboard').then(m => ({ default: m.InsightsDashboard })));
const TaskAnalyticsCard = lazy(() => import('../insights/TaskAnalyticsCard'));
const DailySnapshotCard = lazy(() => import('./DailySnapshotCard'));
const TodayEventsCard = lazy(() => import('./TodayEventsCard'));

const TAB_ORDER = ['dzis', 'tydzien', 'projekty', 'historia'];
const supportsVT = typeof document !== 'undefined' && 'startViewTransition' in document;

const normalizeView = (view: string | null | undefined) => {
  if (!view || view === 'workout' || view === 'mentor' || view === 'mirror' || view === 'body') return 'dzis';
  if (view === 'stream' || view === 'plan' || view === 'progress' || view === 'direction') return 'tydzien';
  if (view === 'stats' || view === 'photos') return 'historia';
  if (view === 'kariera') return 'projekty';
  if (view === 'badania') return 'dzis';
  return view;
};

function ViewFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function isAfter20(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Warsaw',
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    return hour >= 20;
  } catch (e) {
    return new Date().getHours() >= 20;
  }
}

export default function Dashboard({ session }: { session: Session }) {
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'kariera') {
      try { localStorage.setItem('vanguard_view', 'projekty'); } catch (e) {}
      return 'projekty';
    }
    if (viewParam && TAB_ORDER.includes(viewParam)) {
      try { localStorage.setItem('vanguard_view', viewParam); } catch (e) {}
      return viewParam;
    }
    if (params.get('todo') === 'new') {
      window.history.replaceState({}, '', '/');
      return 'todo';
    }
    if (params.get('share_url') || params.get('share_text')) {
      // Return 'links' and do not clear query params yet so LinksInbox can read them
      return 'links';
    }
    return normalizeView(localStorage.getItem('vanguard_view'));
  });
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(['dzis', 'tydzien', 'projekty', 'historia']));
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const { count: pendingActionCount, reload: reloadPendingActions } = usePendingActionCount(session);
  const [historySubTab, setHistorySubTab] = useState<'chronicle' | 'bio'>('chronicle');

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(view)) return prev;
      const next = new Set(prev);
      next.add(view);
      return next;
    });
  }, [view]);
  const [showWorkoutLogger, setShowWorkoutLogger] = useState(false);
  const resumedWorkoutDraft = useRef(false);

  // Android frequently kills a backgrounded PWA tab to reclaim memory; on return the app
  // does a fresh mount and this in-memory flag defaults back to false, stranding the
  // (still-persisted) workout draft with no UI to reach it. Auto-resume into the logger
  // instead of silently landing back on the dashboard.
  useEffect(() => {
    if (resumedWorkoutDraft.current || !userId) return;
    resumedWorkoutDraft.current = true;
    purgeStaleWorkoutDraft(userId);
    if (shouldAutoResumeWorkout(userId)) {
      markWorkoutSessionActive(userId);
      setShowWorkoutLogger(true);
    }
  }, [userId]);

  // Some Android/WebView builds suspend the page in place (no remount) when the
  // user switches to another app and back, but still drop in-memory UI state.
  // Re-check on visibility return so an unfinished workout never silently strands.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setShowWorkoutLogger((prev) => {
        if (prev) return prev;
        if (!shouldAutoResumeWorkout(userId)) return prev;
        markWorkoutSessionActive(userId);
        return true;
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId]);

  // Has the Sunday inbox/section triage already been done this week? Prevents the
  // card from nagging again after completion (it used to have no memory at all).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchLatestTaskReviewDate(userId)
      .then((date) => {
        if (cancelled || !date) return;
        setTaskReviewDoneThisWeek(getWeekStartWarsaw(date) === getWeekStartWarsaw(getTodayWarsaw()));
      })
      .catch((err) => console.error('Error fetching task review date:', err));
    return () => { cancelled = true; };
  }, [userId]);

  const [showSaunaLogger, setShowSaunaLogger] = useState(false);
  const [workoutInitial, setWorkoutInitial] = useState<WorkoutLoggerInitial | null>(null);
  const [workoutKey, setWorkoutKey] = useState(0);
  const [showMorningPlan, setShowMorningPlan] = useState(false);
  const [morningPlanTargetDate, setMorningPlanTargetDate] = useState<string | null>(null);
  const [showShutdown, setShowShutdown] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [taskReviewDoneThisWeek, setTaskReviewDoneThisWeek] = useState(false);
  const [showQuickFoodEntry, setShowQuickFoodEntry] = useState(false);
  const [showFastCapture, setShowFastCapture] = useState(false);
  const [nutritionKey, setNutritionKey] = useState(0);
  const [foodEditEntry, setFoodEditEntry] = useState<any>(null);
  const logoLongPressTimer = useRef<number | null>(null);
  const logoLongPressFired = useRef(false);

  // Theme support
  const [theme, setTheme] = useState(() => localStorage.getItem('vanguard_theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('vanguard_theme', theme); } catch (e) {}
  }, [theme]);

  const haptics = useHaptics();
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleLogoPressStart = useCallback(() => {
    logoLongPressFired.current = false;
    logoLongPressTimer.current = window.setTimeout(() => {
      logoLongPressFired.current = true;
      haptics.medium();
      setShowQuickFoodEntry(true);
    }, 550);
  }, [haptics]);

  const handleLogoPressEnd = useCallback(() => {
    if (logoLongPressTimer.current) {
      clearTimeout(logoLongPressTimer.current);
      logoLongPressTimer.current = null;
    }
  }, []);

  const { reviewOverdueDays, urgentTodoCount, unreadLinkCount, staleNoteCount, refresh: refreshNudge } = useNudgeData(userId);
  const routerNavigate = useNavigate();
  const [planDaySignal, setPlanDaySignal] = useState(0);

  const navigateTo = useCallback((newView: string) => {
    if (newView === view) return;
    haptics.light();
    const fromIdx = TAB_ORDER.indexOf(view);
    const toIdx   = TAB_ORDER.indexOf(newView);
    document.documentElement.dataset.slide = toIdx >= fromIdx ? 'right' : 'left';
    if (supportsVT) {
      (document as any).startViewTransition(() => {
        flushSync(() => setView(newView));
      });
    } else {
      setView(newView);
    }
  }, [view, haptics]);

  // Swipe left/right between the 4 main tabs, in addition to tapping the bottom nav.
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const handleMainTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    swipeStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const handleMainTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    if ((e.target as HTMLElement)?.closest?.('[data-no-swipe-nav]')) return;

    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const deltaT = Date.now() - start.t;

    const isHorizontalEnough = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    const isFarEnough = Math.abs(deltaX) >= 45;
    const isFastEnough = deltaT < 1000;
    if (!isHorizontalEnough || !isFarEnough || !isFastEnough) return;

    const idx = TAB_ORDER.indexOf(view);
    if (idx === -1) return;
    const nextIdx = deltaX < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= TAB_ORDER.length) return;
    navigateTo(TAB_ORDER[nextIdx]);
  }, [view, navigateTo]);

  const handleSpineGuideNavigate = useCallback((target: SpineGuideTarget) => {
    try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {}
    if (target === 'dashboard') {
      routerNavigate('/dashboard');
      return;
    }
    navigateTo(target);
  }, [view, routerNavigate, navigateTo]);

  const goBack = useCallback(() => {
    const prev = localStorage.getItem('vanguard_previous_view');
    if (prev) {
      try { localStorage.removeItem('vanguard_previous_view'); } catch (e) {}
    }
    setView(normalizeView(prev) || 'dzis');
  }, []);

  const { isSyncing, setSyncing } = useStore();
  const { weeklyCalories, todayWin, loading, refresh } = useDashboardData();
  const { guidance: spineGuidance, loading: spineGuidanceLoading } = useSpineGuidance(userId, todayWin);
  const { startGoogleAuth } = useSyncActions({ userId, accessToken, onRefresh: refresh, setSyncing });

  // Auto-suggest Evening Shutdown after 20:00 Warsaw time — once per day, not on every refresh.
  useEffect(() => {
    if (!todayWin) return;
    if (todayWin.day_note?.trim()) return;

    const today = getTodayWarsaw();
    try {
      if (localStorage.getItem('vanguard_shutdown_dismissed') === today) return;
    } catch (e) {}

    const warsawHour = parseInt(
      new Date().toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }),
      10
    );

    if (warsawHour >= 20) {
      setShowShutdown(true);
    }
  }, [todayWin]);

  const handlePlanDay = useCallback(() => {
    haptics.light();
    setShowMorningPlan(true);
    setPlanDaySignal((n) => n + 1);
  }, [haptics]);

  const handleFocusPlan = useCallback(() => {
    haptics.light();
    document.getElementById('day-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [haptics]);

  const showLock = !todayWin;

  useEffect(() => {
    try { localStorage.setItem('vanguard_view', view); } catch (e) {}
  }, [view]);

  if (view === 'fundament') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <Fundament session={session} onBack={goBack} onSyncCalendar={startGoogleAuth} isSyncing={isSyncing} />
      </Suspense>
    );
  }

  if (view === 'keep') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <Keep
          session={session}
          onBack={goBack}
          onNavigateTo={(dest) => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView(dest); }}
        />
      </Suspense>
    );
  }

  if (view === 'todo') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <Todo
          session={session}
          onBack={() => { refreshNudge(); goBack(); }}
          onNavigateTo={(dest) => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView(dest); }}
        />
      </Suspense>
    );
  }

  if (view === 'links') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <LinksInbox
          session={session}
          onBack={goBack}
          onNavigateTo={(dest) => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView(dest); }}
        />
      </Suspense>
    );
  }

  if (view === 'kalendarz') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <CalendarView
          session={session}
          onBack={goBack}
          onSyncCalendar={startGoogleAuth}
          isSyncing={isSyncing}
          onNavigateTo={(dest) => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView(dest); }}
        />
      </Suspense>
    );
  }





  if (showSaunaLogger) {
    return (
      <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
        <Suspense fallback={<ViewFallback />}>
          <SaunaLoggerModal
            session={session}
            onSaved={() => { refresh(); setWorkoutKey((k) => k + 1); }}
            onBack={() => { setShowSaunaLogger(false); refresh(); }}
          />
        </Suspense>
      </div>
    );
  }

  if (showWorkoutLogger) {
    return (
      <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
        <Suspense fallback={<ViewFallback />}>
          <WorkoutLogger
            session={session}
            initial={workoutInitial}
            onSaved={() => { refresh(); setWorkoutKey((k) => k + 1); }}
            onBack={() => { setShowWorkoutLogger(false); setWorkoutInitial(null); refresh(); }}
          />
        </Suspense>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const navItems = [
    { id: 'dzis', icon: Sun, label: 'Dziś' },
    { id: 'tydzien', icon: Calendar, label: 'Tydzień' },
    { id: 'projekty', icon: FolderKanban, label: 'Projekty' },
    { id: 'historia', icon: Clock, label: 'Historia' },
  ];

  const weeklyReviewNudge = new Date().getDay() === 0 && !taskReviewDoneThisWeek && (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h4 className="text-[12px] font-black text-indigo-500 uppercase tracking-wider">Tygodniowy Przegląd Zadań</h4>
        <p className="text-[10px] text-text-secondary mt-0.5 break-words">Niedziela to czas na oczyszczenie skrzynki i audyt projektów.</p>
      </div>
      <button
        onClick={() => setShowWeeklyReview(true)}
        className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black transition-colors btn-press shadow-sm"
      >
        Rozpocznij
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary/10 font-sans transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden border-x border-border-custom bg-background/40 backdrop-blur-3xl shadow-sm" style={{ paddingBottom: showLock ? '2rem' : 'calc(6rem + env(safe-area-inset-bottom))' }}>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border-custom/50 bg-background/70 px-5 py-4.5 backdrop-blur-md shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)]">
          <div className="min-w-0 shrink-0">
            <h1
              className="font-display text-sm text-primary select-none cursor-pointer flex items-center gap-1.5"
              title="Przytrzymaj, żeby szybko dodać posiłek"
              onPointerDown={handleLogoPressStart}
              onPointerUp={handleLogoPressEnd}
              onPointerLeave={handleLogoPressEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              <BrandTitle />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" title="System Online" />
            </h1>
            <p className="mt-1 text-[8.5px] font-black uppercase tracking-wider text-text-muted/65">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })}
            </p>
          </div>
          <div className="header-icon-row flex min-w-0 items-center gap-2 overflow-x-auto">
            {session?.user?.id && (
              <PersonaAvatarButton
                userId={session.user.id}
                unreadCount={pendingActionCount}
                onLongPress={() => setActionCenterOpen(true)}
                onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('fundament'); }}
              />
            )}
            <button
              onClick={toggleTheme}
              className="shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/15 transition-all duration-300 active:scale-90 cursor-pointer flex items-center justify-center"
              title="Przełącz motyw"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} className="text-yellow-500" />}
            </button>
            {!showLock && (
              <>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('todo'); }}
                  className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                    view === 'todo'
                      ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                      : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
                  }`}
                  title="Zadania"
                >
                  <CheckSquare size={15} />
                </button>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('kalendarz'); }}
                  className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                    view === 'kalendarz'
                      ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                      : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
                  }`}
                  title="Kalendarz"
                >
                  <Calendar size={15} />
                </button>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('keep'); }}
                  className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                    view === 'keep'
                      ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                      : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
                  }`}
                  title="Notatki"
                >
                  <StickyNote size={15} />
                  {staleNoteCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-black text-white shadow-sm ring-1 ring-background">
                      {staleNoteCount > 9 ? '9+' : staleNoteCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('links'); }}
                  className={`shrink-0 relative rounded-full border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center ${
                    view === 'links'
                      ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] scale-105'
                      : 'bg-surface-solid/5 border-border-custom text-text-muted hover:text-text-primary hover:bg-surface-solid/15'
                  }`}
                  title="Zapisane linki"
                >
                  <Bookmark size={15} />
                </button>

                <Link
                  to="/dashboard"
                  className="shrink-0 rounded-full border border-border-custom bg-surface-solid/5 p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-solid/15 transition-all duration-300 active:scale-95 cursor-pointer flex items-center justify-center"
                  title="Desktop dashboard"
                >
                  <LayoutDashboard size={15} />
                </Link>
              </>
            )}
          </div>
        </header>

        <main
          className="flex-1 overflow-hidden vt-tab-main"
          onTouchStart={showLock ? undefined : handleMainTouchStart}
          onTouchEnd={showLock ? undefined : handleMainTouchEnd}
        >
          {showLock ? (
            <div className="p-5 pb-8 space-y-7 overflow-y-auto h-full">
              <OrientationFooter session={session} />
              <SpineGuideStrip
                guidance={spineGuidance}
                loading={spineGuidanceLoading}
                onNavigate={handleSpineGuideNavigate}
                onPlanDay={handlePlanDay}
                onFocusPlan={handleFocusPlan}
              />
              {weeklyReviewNudge}
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} planDaySignal={planDaySignal} />
              {todayWin && isAfter20() && (
                <button
                  onClick={() => setShowShutdown(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm font-black uppercase tracking-wider text-indigo-500 hover:bg-indigo-500/20 active:scale-95 transition-all shadow-sm mt-4"
                >
                  Domknij Dzień (Rytuał Wieczorny)
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Each tab is always mounted but hidden when inactive — prevents full remount/freeze on switch */}
              <ErrorBoundary>
              {mountedTabs.has('dzis') && (
              <div className={`p-5 pb-8 ${view === 'dzis' ? '' : 'hidden'}`}>
                <div className="space-y-5">
              <OrientationFooter session={session} />
              <SpineGuideStrip
                guidance={spineGuidance}
                loading={spineGuidanceLoading}
                onNavigate={handleSpineGuideNavigate}
                onPlanDay={handlePlanDay}
                onFocusPlan={handleFocusPlan}
              />
              {weeklyReviewNudge}

              <Suspense fallback={<ViewFallback />}>
                <DailyStrainCard session={session} refreshSignal={nutritionKey + workoutKey} />
              </Suspense>

              <Suspense fallback={null}>
                <TodayEventsCard session={session} />
              </Suspense>

              <FoodQuickCapture
                session={session}
                refreshSignal={nutritionKey}
                onSaved={() => { refresh(); setNutritionKey((k) => k + 1); }}
                onOpenFullModal={() => setShowQuickFoodEntry(true)}
              />

              {/* Hide for now as it is accessible from the bottom '+' button
              <TrainingSaunaQuickBar
                session={session}
                refreshSignal={workoutKey}
                onOpenWorkout={() => {
                  setWorkoutInitial(null);
                  if (userId) markWorkoutSessionActive(userId);
                  setShowWorkoutLogger(true);
                }}
                onOpenSauna={() => setShowSaunaLogger(true)}
              />
              */}

              {/* Hide for now
              <Link
                to="/optics"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95 shadow-sm"
              >
                Zaloguj Wzrok
              </Link>
              */}

              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} planDaySignal={planDaySignal} />
              {todayWin && isAfter20() && (
                <button
                  onClick={() => setShowShutdown(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm font-black uppercase tracking-wider text-indigo-500 hover:bg-indigo-500/20 active:scale-95 transition-all shadow-sm"
                >
                  Domknij Dzień (Rytuał Wieczorny)
                </button>
              )}

              <Suspense fallback={<ViewFallback />}>
                <DailySnapshotCard session={session} />
              </Suspense>
            </div>
          </div>
          )}

          </ErrorBoundary>
          <ErrorBoundary>
          {mountedTabs.has('tydzien') && (
          <div className={`p-5 pb-8 ${view === 'tydzien' ? '' : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <NutritionTrainingBarCard session={session} refreshSignal={nutritionKey} />
                <NutritionCard
                  weeklyCalories={weeklyCalories}
                  session={session}
                  refreshSignal={nutritionKey}
                />
                <Direction session={session} onOpenActionCenter={() => setActionCenterOpen(true)} />
              </div>
            </Suspense>
          </div>
          )}

          </ErrorBoundary>
          <ErrorBoundary>
          {mountedTabs.has('historia') && (
          <div className={`p-5 pb-8 ${view === 'historia' ? '' : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-6">
                <div className="flex justify-center px-1">
                  <div className="flex w-full p-0.75 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-border-custom/50">
                    <button
                      type="button"
                      onClick={() => setHistorySubTab('chronicle')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer text-[12px] font-bold ${historySubTab === 'chronicle' ? 'bg-white dark:bg-surface-solid shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-primary' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      <Sparkles size={14} />
                      <span>Kronika</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistorySubTab('bio')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all cursor-pointer text-[12px] font-bold ${historySubTab === 'bio' ? 'bg-white dark:bg-surface-solid shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-primary' : 'text-text-muted hover:text-text-primary'}`}
                    >
                      <Activity size={14} />
                      <span>Trener & Bio</span>
                    </button>
                  </div>
                </div>

                <div className={historySubTab === 'chronicle' ? 'space-y-7' : 'hidden'}>
                  <TaskAnalyticsCard session={session} />
                  <InsightsDashboard session={session} />
                  <Photos session={session} />
                </div>
                <div className={historySubTab === 'bio' ? '' : 'hidden'}>
                  <Stats session={session} runningSlot={<StravaWidget session={session} />} />
                </div>
              </div>
            </Suspense>
          </div>
          )}

          </ErrorBoundary>
          <ErrorBoundary>
          {mountedTabs.has('projekty') && (
          <div className={`p-5 pb-8 ${view === 'projekty' ? '' : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <Projects
                session={session}
                reviewOverdueDays={reviewOverdueDays}
                onNavigateTo={(dest) => {
                  try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {}
                  setView(dest);
                }}
              />
            </Suspense>
          </div>
          )}
          </ErrorBoundary>
          </>
          )}
        </main>
      </div>

      {/* Fast Capture Floating Button & Menu */}
      {!showLock && (
        <>
          {showFastCapture && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-35 bg-black/40 backdrop-blur-[2.5px] transition-all animate-fadeIn" 
                onClick={() => setShowFastCapture(false)} 
              />
              
              {/* Actions Menu */}
              <div 
                className="fixed left-1/2 z-40 flex flex-col items-center gap-2.5 transition-all"
                style={{ 
                  bottom: 'calc(max(2rem, calc(1rem + env(safe-area-inset-bottom))) + 4.5rem)',
                  transform: 'translateX(-50%)'
                }}
              >
                {[
                  { label: 'Dodaj Jedzenie', emoji: '🍎', color: 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5', action: () => { setShowQuickFoodEntry(true); } },
                  { label: 'Zaloguj Trening', emoji: '🏋️', color: 'border-orange-500/20 text-orange-500 hover:bg-orange-500/5', action: () => { setWorkoutInitial(null); if (userId) markWorkoutSessionActive(userId); setShowWorkoutLogger(true); } },
                  { label: 'Zaloguj Saunę', emoji: '🧖', color: 'border-amber-500/20 text-amber-500 hover:bg-amber-500/5', action: () => { setShowSaunaLogger(true); } },
                ].map((item, idx) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setShowFastCapture(false);
                      item.action();
                    }}
                    className={`fast-capture-menu-item flex items-center gap-2.5 px-5 py-3 rounded-full border border-border-custom bg-surface/90 text-[11.5px] font-black uppercase tracking-wider text-text-primary shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer ${item.color.split(' ').slice(1).join(' ')}`}
                    style={{
                      animation: `fade-in-up 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                      animationDelay: `${idx * 0.04}s`,
                      opacity: 0,
                      transform: 'translateY(15px)'
                    }}
                  >
                    <span className="text-[13px]">{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!showLock && (
        <nav className="fixed left-1/2 z-40 flex w-[90%] max-w-[360px] -translate-x-1/2 items-center justify-between rounded-full border border-border-custom bg-surface/80 p-1.5 shadow-[var(--shadow-nav)] backdrop-blur-xl" style={{ bottom: 'max(2rem, calc(1rem + env(safe-area-inset-bottom)))' }}>
          {/* Sliding background indicator pill */}
          <div 
            className="absolute top-1.5 bottom-1.5 rounded-full nav-pill-active transition-all duration-300"
            style={{
              width: 'calc(20% - 3px)',
              left: (() => {
                const idx = TAB_ORDER.indexOf(view);
                const slotIndex = idx < 2 ? idx : idx + 1;
                return `calc(${slotIndex * 20}% + 1.5px)`;
              })(),
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
          {(() => {
            const elements: React.ReactNode[] = [];
            navItems.forEach((item, idx) => {
              elements.push(
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  disabled={false}
                  className={`relative z-10 flex flex-1 flex-col items-center gap-1 rounded-full py-2.5 transition-all duration-300 active:scale-95 cursor-pointer disabled:cursor-default ${
                    view === item.id
                      ? 'text-primary font-black'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <div className="relative">
                    <item.icon size={16} className={`transition-transform duration-300 ${view === item.id ? 'scale-110' : 'scale-100'}`} />
                    {item.id === 'dzis' && urgentTodoCount > 0 && (
                      <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-black text-white shadow-sm">
                        {urgentTodoCount > 9 ? '9+' : urgentTodoCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                </button>
              );

              if (idx === 1) {
                elements.push(
                  <div key="fab-slot" className="relative flex-1 flex items-center justify-center h-full" />
                );
              }
            });
            return elements;
          })()}
        </nav>
      )}

      {!showLock && (
        <button
          onClick={() => setShowFastCapture(v => !v)}
          className="fast-capture-btn fixed left-1/2 z-50 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-white hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer"
          style={{
            bottom: 'calc(max(2rem, calc(1rem + env(safe-area-inset-bottom))) + 1.95rem)',
          }}
        >
          <div className={`transition-transform duration-300 ${showFastCapture ? 'rotate-[135deg]' : ''}`}>
            <Plus size={18} strokeWidth={3.5} />
          </div>
        </button>
      )}

      {showMorningPlan && (
        <MorningPlanModal
          session={session}
          targetDate={morningPlanTargetDate ?? undefined}
          onClose={() => { setShowMorningPlan(false); setMorningPlanTargetDate(null); }}
        />
      )}

      {showShutdown && (
        <DailyShutdownModal
          session={session}
          onClose={() => {
            try { localStorage.setItem('vanguard_shutdown_dismissed', getTodayWarsaw()); } catch (e) {}
            setShowShutdown(false);
          }}
          onSaved={refresh}
          onPlanTomorrow={() => {
            const tomorrow = new Date(`${getTodayWarsaw()}T12:00:00Z`);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
            try { localStorage.setItem('vanguard_shutdown_dismissed', getTodayWarsaw()); } catch (e) {}
            setShowShutdown(false);
            setMorningPlanTargetDate(tomorrow.toISOString().slice(0, 10));
            setShowMorningPlan(true);
          }}
        />
      )}

      {showWeeklyReview && (
        <WeeklyReviewModal
          session={session}
          onClose={() => setShowWeeklyReview(false)}
          onFinished={() => {
            setTaskReviewDoneThisWeek(true);
            refresh();
          }}
        />
      )}

      {showQuickFoodEntry && (
        <FoodEntryModal
          session={session}
          onClose={() => { setShowQuickFoodEntry(false); setFoodEditEntry(null); }}
          onSaved={() => { refresh(); setNutritionKey(k => k + 1); }}
          initialEditEntry={foodEditEntry ?? undefined}
        />
      )}

      {session && (
        <ActionCenterSheet
          session={session}
          open={actionCenterOpen}
          onClose={() => setActionCenterOpen(false)}
          onUpdated={() => void reloadPendingActions()}
        />
      )}
    </div>
  );
}
