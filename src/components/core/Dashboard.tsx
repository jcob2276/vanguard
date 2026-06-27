import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Calendar,
  FolderKanban,
  CheckSquare,
  Clock,
  LayoutDashboard,
  Moon,
  Sun,
  Paintbrush,
  Bookmark,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ErrorBoundary } from './ErrorBoundary';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useHaptics } from '../../hooks/useHaptics';
import { useNudgeData } from '../../hooks/useNudgeData';
import { useSyncActions } from '../../hooks/useSyncActions';
import GoalsCard from '../lifestyle/GoalsCard';
import PowerList from '../lifestyle/PowerList';
import OrientationFooter from './OrientationFooter';
import NutritionCard from './NutritionCard';
import FoodQuickCapture from './nutrition/FoodQuickCapture';
import TodayMealsCard from './nutrition/TodayMealsCard';
import TodayWorkoutsCard from '../biometrics/TodayWorkoutsCard';
import TrainingSaunaQuickBar from '../biometrics/TrainingSaunaQuickBar';
import WorkoutQuickCapture from '../biometrics/WorkoutQuickCapture';
import { loadWorkoutTemplate, loadWorkoutDraft, type WorkoutLoggerInitial } from '../../lib/workoutLogging';
import CaptureQueueCard from './CaptureQueueCard';
import FoodEntryModal from './nutrition/FoodEntryModal';

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

const WeeklyReview = lazy(() => import('../lifestyle/WeeklyReview'));
import { BrandTitle } from '../ui/BrandTitle';
import { PersonaAvatarButton } from '../ui/PersonaAvatarButton';
const InsightsDashboard = lazy(() => import('../insights/InsightsDashboard').then(m => ({ default: m.InsightsDashboard })));
const BlockTimer = lazy(() => import('../lifestyle/BlockTimer'));
const CheckpointsCard = lazy(() => import('../projects/CheckpointsCard'));
const DailySnapshotCard = lazy(() => import('./DailySnapshotCard'));
const MorningBriefCard = lazy(() => import('./MorningBriefCard'));
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
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set([normalizeView(localStorage.getItem('vanguard_view')) || 'dzis']));

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
    if (loadWorkoutDraft(userId)) setShowWorkoutLogger(true);
  }, [userId]);

  // Some Android/WebView builds suspend the page in place (no remount) when the
  // user switches to another app and back, but still drop in-memory UI state.
  // Re-check on visibility return so an unfinished workout never silently strands.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setShowWorkoutLogger((prev) => prev || !!loadWorkoutDraft(userId));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId]);
  const [showSaunaLogger, setShowSaunaLogger] = useState(false);
  const [workoutInitial, setWorkoutInitial] = useState<WorkoutLoggerInitial | null>(null);
  const [workoutKey, setWorkoutKey] = useState(0);
  const [showQuickFoodEntry, setShowQuickFoodEntry] = useState(false);
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

  const goBack = useCallback(() => {
    const prev = localStorage.getItem('vanguard_previous_view');
    if (prev) {
      try { localStorage.removeItem('vanguard_previous_view'); } catch (e) {}
    }
    setView(normalizeView(prev) || 'dzis');
  }, []);

  const { isSyncing, setSyncing } = useStore();
  const { weeklyCalories, todayWin, loading, refresh } = useDashboardData();
  const { startGoogleAuth } = useSyncActions({ userId, accessToken, onRefresh: refresh, setSyncing });

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



  if (view === 'weekly-review') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <WeeklyReview
          session={session}
          onBack={() => {
            refreshNudge();
            setView(normalizeView(localStorage.getItem('vanguard_previous_view')) || 'dzis');
          }}
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

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary/10 font-sans transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border-custom bg-background/40 backdrop-blur-3xl shadow-sm" style={{ paddingBottom: showLock ? '2rem' : 'calc(6rem + env(safe-area-inset-bottom))' }}>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border-custom bg-background/80 px-5 py-4.5 backdrop-blur-md">
          <div>
            <h1
              className="font-display text-sm text-primary select-none cursor-pointer"
              title="Przytrzymaj, żeby szybko dodać posiłek"
              onPointerDown={handleLogoPressStart}
              onPointerUp={handleLogoPressEnd}
              onPointerLeave={handleLogoPressEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              <BrandTitle />
            </h1>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {session?.user?.id && (
              <PersonaAvatarButton
                userId={session.user.id}
                onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('fundament'); }}
              />
            )}
            <button
              onClick={toggleTheme}
              className="rounded-full border border-border-custom bg-surface-solid/40 dark:bg-white/[0.03] p-2.5 text-text-secondary hover:text-text-primary hover:bg-surface-solid transition-all active:scale-95 cursor-pointer"
              title="Przełącz motyw"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} className="text-yellow-500" />}
            </button>
            {!showLock && (
              <>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('todo'); }}
                  className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
                  title="Zadania"
                >
                  <CheckSquare size={15} />
                </button>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('keep'); }}
                  className="relative rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
                  title="Notatki"
                >
                  <Paintbrush size={15} />
                  {staleNoteCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-black text-white shadow-sm">
                      {staleNoteCount > 9 ? '9+' : staleNoteCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('links'); }}
                  className="relative rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
                  title="Zapisane linki"
                >
                  <Bookmark size={15} />
                  {unreadLinkCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-black text-white shadow-sm">
                      {unreadLinkCount > 9 ? '9+' : unreadLinkCount}
                    </span>
                  )}
                </button>
                <Link
                  to="/dashboard"
                  className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
                  title="Desktop dashboard"
                >
                  <LayoutDashboard size={15} />
                </Link>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-hidden vt-tab-main">
          {showLock ? (
            <div className="p-5 pb-8 space-y-7 overflow-y-auto h-full">
              <OrientationFooter session={session} />
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />
            </div>
          ) : (
            <>
              {/* Each tab is always mounted but hidden when inactive — prevents full remount/freeze on switch */}
              <ErrorBoundary>
              {mountedTabs.has('dzis') && (
              <div className={`p-5 pb-8 ${view === 'dzis' ? '' : 'hidden'}`}>
                <div className="space-y-5">
              <OrientationFooter session={session} />

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

              <TrainingSaunaQuickBar
                session={session}
                refreshSignal={workoutKey}
                onOpenWorkout={() => {
                  setWorkoutInitial(null);
                  setShowWorkoutLogger(true);
                }}
                onOpenSauna={() => setShowSaunaLogger(true)}
              />

              <WorkoutQuickCapture
                session={session}
                refreshSignal={workoutKey}
                onSaved={() => { refresh(); setWorkoutKey((k) => k + 1); }}
                onOpenLogger={(initial) => {
                  setWorkoutInitial(initial ?? null);
                  setShowWorkoutLogger(true);
                }}
              />

              <TodayMealsCard
                session={session}
                refreshSignal={nutritionKey}
                onEditEntry={(entry) => {
                  setFoodEditEntry(entry);
                  setShowQuickFoodEntry(true);
                }}
              />

              <CaptureQueueCard
                session={session}
                onNavigate={(dest) => {
                  try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {}
                  setView(dest);
                }}
                onQueueChange={refreshNudge}
              />

              <TodayWorkoutsCard
                session={session}
                refreshSignal={workoutKey}
                onOpenLogger={async () => {
                  const tpl = await loadWorkoutTemplate(session.user.id);
                  setWorkoutInitial(tpl);
                  setShowWorkoutLogger(true);
                }}
              />

              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />

              <Suspense fallback={<ViewFallback />}>
                <DailySnapshotCard session={session} />
              </Suspense>

              <Suspense fallback={<ViewFallback />}>
                <CheckpointsCard session={session} onNavigateTo={(dest) => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} navigateTo(dest); }} />
              </Suspense>

              <GoalsCard session={session} />
            </div>
          </div>
          )}

          </ErrorBoundary>
          <ErrorBoundary>
          {mountedTabs.has('tydzien') && (
          <div className={`p-5 pb-8 ${view === 'tydzien' ? '' : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <NutritionCard
                  weeklyCalories={weeklyCalories}
                  session={session}
                  refreshSignal={nutritionKey}
                />
                <Direction session={session} />
              </div>
            </Suspense>
          </div>
          )}

          </ErrorBoundary>
          <ErrorBoundary>
          {mountedTabs.has('historia') && (
          <div className={`p-5 pb-8 ${view === 'historia' ? '' : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <InsightsDashboard session={session} />
                <Stats session={session} runningSlot={<StravaWidget session={session} />} />
                <Photos session={session} />
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

      {!showLock && (
        <nav className="fixed left-1/2 z-40 flex w-[90%] max-w-[360px] -translate-x-1/2 items-center justify-between rounded-full border border-border-custom bg-surface/80 p-1.5 shadow-[var(--shadow-nav)] backdrop-blur-xl" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
          {/* Sliding background indicator pill */}
          <div 
            className="absolute top-1.5 bottom-1.5 rounded-full bg-primary/10 transition-all duration-300"
            style={{
              width: 'calc(25% - 3px)',
              left: `calc(${TAB_ORDER.indexOf(view) * 25}% + 1.5px)`,
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
          {navItems.map((item) => (
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
          ))}
        </nav>
      )}

      {showQuickFoodEntry && (
        <FoodEntryModal
          session={session}
          onClose={() => { setShowQuickFoodEntry(false); setFoodEditEntry(null); }}
          onSaved={() => { refresh(); setNutritionKey(k => k + 1); }}
          initialEditEntry={foodEditEntry ?? undefined}
        />
      )}
    </div>
  );
}
