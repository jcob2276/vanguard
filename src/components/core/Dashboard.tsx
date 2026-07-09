import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { flushSync } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Calendar,
  FolderKanban,
  Clock,
  Sun,
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
import { markWorkoutSessionActive, type WorkoutLoggerInitial } from '../../lib/workoutLogging';
import { fetchLatestTaskReviewDate } from '../../lib/todo';
import { getWeekStartWarsaw } from '../../lib/growth';

import { usePendingActionCount } from '../shared/ActionCenterSheet';
import { useWorkoutResume } from '../../hooks/useWorkoutResume';
import { useDashboardSwipeNav } from '../../hooks/useDashboardSwipeNav';
import { DashboardHeader } from './DashboardHeader';
import { DashboardNavBar } from './DashboardNavBar';
import { DashboardModals } from './DashboardModals';
import SearchModal from './SearchModal';

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
  } catch (e: any) {
    return new Date().getHours() >= 20;
  }
}

export default function Dashboard({ session }: { session: Session }) {
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  const location = useLocation();
  const navigate = useNavigate();

  // Resolve active view from URL path
  const rawView = location.pathname === '/' ? 'dzis' : location.pathname.substring(1);
  const view = normalizeView(rawView);

  // Handle redirects/deep links with query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const viewParam = params.get('view');
    if (viewParam === 'kariera') {
      navigate('/projekty', { replace: true });
    } else if (viewParam && TAB_ORDER.includes(viewParam)) {
      navigate('/' + viewParam, { replace: true });
    } else if (params.get('todo') === 'new') {
      navigate('/todo?new=1', { replace: true });
    } else if (params.get('share_url') || params.get('share_text') || params.get('share_title')) {
      // Route by content: an actual link goes to the Links inbox; plain shared
      // text/title (no URL) has no home there, so it goes to Keep as a captured note.
      const shared = `${params.get('share_url') || ''} ${params.get('share_text') || ''}`;
      const hasUrl = /https?:\/\/[^\s]+/.test(shared);
      navigate({ pathname: hasUrl ? '/links' : '/keep', search: location.search }, { replace: true });
    }
  }, [location.search, navigate]);

  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const { count: pendingActionCount, reload: reloadPendingActions } = usePendingActionCount(session);
  const [historySubTab, setHistorySubTab] = useState<'chronicle' | 'bio'>('chronicle');
  
  useWorkoutResume(userId, useCallback(() => {
    if (location.pathname !== '/trening') {
      navigate('/trening');
    }
  }, [location.pathname, navigate]));
  const [workoutInitial, setWorkoutInitial] = useState<WorkoutLoggerInitial | null>(null);
  const [workoutKey, setWorkoutKey] = useState(0);
  const [showMorningPlan, setShowMorningPlan] = useState(false);
  const [morningPlanTargetDate, setMorningPlanTargetDate] = useState<string | null>(null);
  const [showShutdown, setShowShutdown] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [taskReviewDoneThisWeek, setTaskReviewDoneThisWeek] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!userId || !view) return;
    supabase.from('view_events').insert({ user_id: userId, view_name: view })
      .then(({ error }) => {
        if (error) console.error(error);
      });
  }, [userId, view]);

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
  const [showQuickFoodEntry, setShowQuickFoodEntry] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('meal') === 'new') {
      navigate('/', { replace: true });
      window.setTimeout(() => setShowQuickFoodEntry(true), 0);
    }
  }, [location.search, navigate]);
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
    try { localStorage.setItem('vanguard_theme', theme); } catch (e: any) {
      console.error('[Background Error]', e);
    }
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

  const { reviewOverdueDays, urgentTodoCount, staleNoteCount, refresh: refreshNudge } = useNudgeData(userId);
  const [planDaySignal, setPlanDaySignal] = useState(0);

  const navigateTo = useCallback((newView: string) => {
    if (newView === view) return;
    haptics.light();
    const fromIdx = TAB_ORDER.indexOf(view);
    const toIdx   = TAB_ORDER.indexOf(newView);
    document.documentElement.dataset.slide = toIdx >= fromIdx ? 'right' : 'left';
    const path = '/' + newView;
    if (supportsVT) {
      (document as any).startViewTransition(() => {
        flushSync(() => navigate(path));
      });
    } else {
      navigate(path);
    }
  }, [view, haptics, navigate]);

  const { handleMainTouchStart, handleMainTouchEnd } = useDashboardSwipeNav({
    view,
    navigateTo,
    tabOrder: TAB_ORDER,
  });

  const handleSpineGuideNavigate = useCallback((target: SpineGuideTarget) => {
    if (target === 'dashboard') {
      navigate('/dashboard');
      return;
    }
    navigateTo(target);
  }, [navigate, navigateTo]);

  const goBack = useCallback(() => {
    haptics.light();
    navigate('/dzis');
  }, [haptics, navigate]);

  const { isSyncing, setSyncing } = useStore();
  const { weeklyCalories, todayWin, loading, refresh } = useDashboardData();
  const { guidance: spineGuidance, loading: spineGuidanceLoading } = useSpineGuidance(userId, todayWin);
  const { syncCalendar, startGoogleAuth } = useSyncActions({ userId, accessToken, onRefresh: refresh, setSyncing });

  // Auto-suggest Evening Shutdown after 20:00 Warsaw time — once per day, not on every refresh.
  useEffect(() => {
    if (!todayWin) return;
    if (todayWin.day_note?.trim()) return;

    const today = getTodayWarsaw();
    try {
      if (localStorage.getItem('vanguard_shutdown_dismissed') === today) return;
    } catch (e: any) {
      console.error('[Background Error]', e);
    }

    const warsawHour = parseInt(
      new Date().toLocaleTimeString('en-CA', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }),
      10
    );

    if (warsawHour >= 20) {
      setTimeout(() => setShowShutdown(true), 0);
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
          onNavigateTo={(dest) => navigate('/' + dest)}
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
          onNavigateTo={(dest) => navigate('/' + dest)}
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
          onNavigateTo={(dest) => navigate('/' + dest)}
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
          onResyncCalendar={syncCalendar}
          isSyncing={isSyncing}
          onNavigateTo={(dest) => navigate('/' + dest)}
        />
      </Suspense>
    );
  }





  if (view === 'sauna') {
    return (
      <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
        <Suspense fallback={<ViewFallback />}>
          <SaunaLoggerModal
            session={session}
            onSaved={() => { refresh(); setWorkoutKey((k) => k + 1); navigate('/dzis'); }}
            onBack={() => { refresh(); navigate('/dzis'); }}
          />
        </Suspense>
      </div>
    );
  }

  if (view === 'trening') {
    return (
      <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
        <Suspense fallback={<ViewFallback />}>
          <WorkoutLogger
            session={session}
            initial={workoutInitial}
            onSaved={() => { refresh(); setWorkoutKey((k) => k + 1); navigate('/dzis'); }}
            onBack={() => { setWorkoutInitial(null); refresh(); navigate('/dzis'); }}
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
        <DashboardHeader
          userId={userId}
          unreadCount={pendingActionCount}
          onAvatarLongPress={() => setActionCenterOpen(true)}
          onAvatarClick={() => navigate('/fundament')}
          theme={theme}
          toggleTheme={toggleTheme}
          showLock={showLock}
          view={view}
          onShortcutClick={(dest) => navigate('/' + dest)}
          onSearchClick={() => setShowSearch(true)}
          staleNoteCount={staleNoteCount}
          handleLogoPressStart={handleLogoPressStart}
          handleLogoPressEnd={handleLogoPressEnd}
        />

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
              {/* Render only active tab to save CPU/memory and avoid background charts rendering */}
              <ErrorBoundary>
              {view === 'dzis' && (
              <div className="p-5 pb-8">
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
          {view === 'tydzien' && (
          <div className="p-5 pb-8">
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
          {view === 'historia' && (
          <div className="p-5 pb-8">
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
          {view === 'projekty' && (
          <div className="p-5 pb-8">
            <Suspense fallback={<ViewFallback />}>
              <Projects
                session={session}
                reviewOverdueDays={reviewOverdueDays}
                onNavigateTo={(dest) => navigate('/' + dest)}
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
                  { label: 'Zaloguj Trening', emoji: '🏋️', color: 'border-orange-500/20 text-orange-500 hover:bg-orange-500/5', action: () => { setWorkoutInitial(null); if (userId) markWorkoutSessionActive(userId); navigate('/trening'); } },
                  { label: 'Zaloguj Saunę', emoji: '🧖', color: 'border-amber-500/20 text-amber-500 hover:bg-amber-500/5', action: () => { navigate('/sauna'); } },
                  { label: 'Zmierz Wzrok', emoji: '👁️', color: 'border-teal-500/20 text-teal-500 hover:bg-teal-500/5', action: () => { navigate('/optics'); } },
                ].map((item, idx) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setShowFastCapture(false);
                      item.action();
                    }}
                    className={`fast-capture-menu-item flex items-center gap-2.5 px-5 py-3 rounded-full border border-border-custom bg-surface/90 text-[11.5px] font-black uppercase tracking-wider text-text-primary shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer ${item.color.split(' ').slice(1).join(' ')}`}
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
        <DashboardNavBar
          view={view}
          navigateTo={navigateTo}
          urgentTodoCount={urgentTodoCount}
          navItems={navItems}
          tabOrder={TAB_ORDER}
        />
      )}

      {!showLock && (
        <button
          onClick={() => setShowFastCapture(v => !v)}
          className="fast-capture-btn fixed left-1/2 z-50 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-white hover:scale-110 active:scale-95 transition duration-300 cursor-pointer"
          style={{
            bottom: 'calc(max(2rem, calc(1rem + env(safe-area-inset-bottom))) + 1.95rem)',
          }}
        >
          <div className={`transition-transform duration-300 ${showFastCapture ? 'rotate-[135deg]' : ''}`}>
            <Plus size={18} strokeWidth={3.5} />
          </div>
        </button>
      )}

      <DashboardModals
        session={session}
        showMorningPlan={showMorningPlan}
        setShowMorningPlan={setShowMorningPlan}
        morningPlanTargetDate={morningPlanTargetDate}
        setMorningPlanTargetDate={setMorningPlanTargetDate}
        showShutdown={showShutdown}
        setShowShutdown={setShowShutdown}
        showWeeklyReview={showWeeklyReview}
        setShowWeeklyReview={setShowWeeklyReview}
        setTaskReviewDoneThisWeek={setTaskReviewDoneThisWeek}
        showQuickFoodEntry={showQuickFoodEntry}
        setShowQuickFoodEntry={setShowQuickFoodEntry}
        foodEditEntry={foodEditEntry}
        setFoodEditEntry={setFoodEditEntry}
        actionCenterOpen={actionCenterOpen}
        setActionCenterOpen={setActionCenterOpen}
        reloadPendingActions={reloadPendingActions}
        refresh={refresh}
        setNutritionKey={setNutritionKey}
      />

      {showSearch && (
        <SearchModal session={session} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
