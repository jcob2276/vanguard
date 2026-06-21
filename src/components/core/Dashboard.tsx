import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  FolderKanban,
  CheckSquare,
  Clock,
  Dumbbell,
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
import CommandButton from './CommandButton';
import DayCounter from './DayCounter';
import NutritionCard from './NutritionCard';

const WorkoutLogger = lazy(() => import('../biometrics/WorkoutLogger'));
const Stats = lazy(() => import('./Stats'));
const Fundament = lazy(() => import('./Fundament'));
const DailyStrainCard = lazy(() => import('../biometrics/DailyStrainCard'));
const StravaWidget = lazy(() => import('../integrations/StravaWidget'));
const MuscleHeatmap = lazy(() => import('../biometrics/MuscleHeatmap'));
const Photos = lazy(() => import('../identity/Photos'));
const Direction = lazy(() => import('../lifestyle/Direction'));
const Projects = lazy(() => import('../projects/Projects'));
const Todo = lazy(() => import('../todo/Todo'));
const LinksInbox = lazy(() => import('../lifestyle/LinksInbox'));
const Keep = lazy(() => import('../notes/Keep'));

const WeeklyReview = lazy(() => import('../lifestyle/WeeklyReview'));
const BlockTimer = lazy(() => import('../lifestyle/BlockTimer'));
const WeeklyAnalytics = lazy(() => import('../lifestyle/WeeklyAnalytics'));
const CheckpointsCard = lazy(() => import('../projects/CheckpointsCard'));
const DailySnapshotCard = lazy(() => import('./DailySnapshotCard'));
const OracleCard = lazy(() => import('../ai/OracleCard'));
const MorningBriefCard = lazy(() => import('./MorningBriefCard'));
const TodayEventsCard = lazy(() => import('./TodayEventsCard'));

const TAB_ORDER = ['dzis', 'tydzien', 'projekty', 'historia'];
const supportsVT = typeof document !== 'undefined' && 'startViewTransition' in document;

const normalizeView = (view: string | null | undefined) => {
  if (!view || view === 'workout' || view === 'mentor' || view === 'mirror' || view === 'body') return 'dzis';
  if (view === 'stream' || view === 'plan' || view === 'progress' || view === 'direction') return 'tydzien';
  if (view === 'stats' || view === 'photos') return 'historia';
  if (view === 'kariera') return 'projekty';
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
  const [showWorkoutLogger, setShowWorkoutLogger] = useState(false);

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

  const { reviewOverdueDays, urgentTodoCount, refresh: refreshNudge } = useNudgeData(userId);

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
  const { weeklyCalories, todayWin, syncYazio, loading, refresh } = useDashboardData();
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
          onBack={goBack}
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

  if (showWorkoutLogger) {
    return (
      <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
        <Suspense fallback={<ViewFallback />}>
          <WorkoutLogger session={session} onBack={() => { setShowWorkoutLogger(false); refresh(); }} />
        </Suspense>
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
            <h1 className="font-display text-sm font-black uppercase tracking-[0.25em] text-primary">Vanguard</h1>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                  className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
                  title="Notatki"
                >
                  <Paintbrush size={15} />
                </button>
                <button
                  onClick={() => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} setView('links'); }}
                  className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
                  title="Zapisane linki"
                >
                  <Bookmark size={15} />
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
              <DayCounter />
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />
            </div>
          ) : (
            <>
              {/* Each tab is always mounted but hidden when inactive — prevents full remount/freeze on switch */}
              <ErrorBoundary>
              <div className={`p-5 pb-8 ${view === 'dzis' ? '' : 'hidden'}`}>
                <div className="space-y-7">
                  <DayCounter />

              {/* Weekly Review nudge */}
              {reviewOverdueDays !== null && reviewOverdueDays >= 7 && (
                <div className="flex flex-wrap items-center gap-2 -mt-3">
                  <button
                    onClick={() => navigateTo('projekty')}
                    className="flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] font-black text-rose-500 cursor-pointer hover:bg-rose-500/20 transition-all"
                  >
                    <AlertCircle size={11} />
                    {reviewOverdueDays >= 100 ? 'Zacznij Weekly Review →' : `${reviewOverdueDays}d bez review →`}
                  </button>
                </div>
              )}

              <GoalsCard session={session} />
              <Suspense fallback={<ViewFallback />}>
                <DailySnapshotCard session={session} />
              </Suspense>

              <Suspense fallback={null}>
                <TodayEventsCard session={session} />
              </Suspense>
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />
              <Suspense fallback={<ViewFallback />}>
                <BlockTimer session={session} todayWin={todayWin} />
              </Suspense>
              <Suspense fallback={<ViewFallback />}>
                <OracleCard session={session} />
              </Suspense>
              <Suspense fallback={<ViewFallback />}>
                <MorningBriefCard session={session} />
              </Suspense>
              <Suspense fallback={<ViewFallback />}>
                <CheckpointsCard session={session} onNavigateTo={(dest) => { try { localStorage.setItem('vanguard_previous_view', view); } catch (e) {} navigateTo(dest); }} />
              </Suspense>
              <CommandButton
                icon={Dumbbell}
                eyebrow="Trening"
                label="Zaloguj trening"
                onClick={() => setShowWorkoutLogger(true)}
              />
              <Suspense fallback={<ViewFallback />}>
                <DailyStrainCard session={session} />
              </Suspense>
            </div>
          </div>

          </ErrorBoundary>
          <ErrorBoundary>
          <div className={`p-5 pb-8 ${view === 'tydzien' ? '' : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <WeeklyAnalytics session={session} />
                <NutritionCard
                  weeklyCalories={weeklyCalories}
                  syncYazio={syncYazio}
                  isSyncing={isSyncing}
                  session={session}
                />
                <Direction session={session} />
              </div>
            </Suspense>
          </div>

          </ErrorBoundary>
          <ErrorBoundary>
          <div className={`p-5 pb-8 ${view === 'historia' ? '' : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <Stats session={session} runningSlot={<StravaWidget session={session} />} />
                <Photos session={session} />
                <MuscleHeatmap session={session} />
              </div>
            </Suspense>
          </div>
          </ErrorBoundary>
          <ErrorBoundary>
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
                {item.id === 'projekty' && reviewOverdueDays !== null && reviewOverdueDays >= 7 && (
                  <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-rose-500 shadow-sm" />
                )}
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

    </div>
  );
}
