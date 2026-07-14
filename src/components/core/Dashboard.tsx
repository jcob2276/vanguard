import { Pressable } from '../ui/ControlPrimitives';
import { TIMEZONE } from '../../lib/date';
import { Suspense, lazy } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sun, Calendar, FolderKanban, Clock } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { DashboardHeader } from './DashboardHeader';
import { DashboardNavBar } from './DashboardNavBar';
import { DashboardModals } from './DashboardModals';
import { DashboardFastCaptureMenu, DashboardFastCaptureFAB } from './DashboardFastCapture';
import OrientationFooter from './OrientationFooter';
import PowerList from '../lifestyle/PowerList';
import SearchModal from './SearchModal';
import { useDashboardState } from './hooks/useDashboardState';
import Spinner from '../ui/Spinner';
import { DashboardContext } from './context/DashboardContext';

const WorkoutLogger   = lazy(() => import('../biometrics/WorkoutLogger'));
const SaunaLoggerModal = lazy(() => import('../biometrics/SaunaLoggerModal'));
const Fundament       = lazy(() => import('./Fundament'));
const Keep            = lazy(() => import('../notes/Keep'));
const Todo            = lazy(() => import('../todo/Todo'));
const LinksInbox      = lazy(() => import('../lifestyle/LinksInbox'));
const CalendarView    = lazy(() => import('../calendar/CalendarView'));

const DashboardDzisTab = lazy(() => import('./DashboardDzisTab').then(m => ({ default: m.DashboardDzisTab })));
const DashboardTydzienTab = lazy(() => import('./DashboardTydzienTab').then(m => ({ default: m.DashboardTydzienTab })));
const DashboardHistoriaTab = lazy(() => import('./DashboardHistoriaTab').then(m => ({ default: m.DashboardHistoriaTab })));
const DashboardProjektyTab = lazy(() => import('./DashboardProjektyTab').then(m => ({ default: m.DashboardProjektyTab })));

const TAB_ORDER = ['dzis', 'tydzien', 'projekty', 'historia'];

function ViewFallback() {
  return (
    <div className="flex min-h-[var(--legacy-h-017)] items-center justify-center rounded-lg border border-on-accent/[0.06] bg-on-accent/[0.02]">
      <Spinner size="md" />
    </div>
  );
}

function isAfter20(): boolean {
  try {
    const h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false }).format(new Date()), 10);
    return h >= 20;
  } catch { return new Date().getHours() >= 20; }
}

export default function Dashboard({ session }: { session: Session }) {
  const s = useDashboardState(session);
  const userId = session?.user?.id;

  // ── Full-screen route views ──
  if (s.view === 'fundament') return (
    <Suspense fallback={<ViewFallback />}>
      <Fundament onBack={s.goBack} onSyncCalendar={s.startGoogleAuth} isSyncing={s.isSyncing} />
    </Suspense>
  );
  if (s.view === 'keep') return (
    <Suspense fallback={<ViewFallback />}>
      <Keep onBack={s.goBack} onNavigateTo={dest => s.navigate('/' + dest)} />
    </Suspense>
  );
  if (s.view === 'todo') return (
    <Suspense fallback={<ViewFallback />}>
      <Todo onBack={() => { s.refreshNudge(); s.goBack(); }} onNavigateTo={dest => s.navigate('/' + dest)} />
    </Suspense>
  );
  if (s.view === 'links') return (
    <Suspense fallback={<ViewFallback />}>
      <LinksInbox onBack={s.goBack} onNavigateTo={dest => s.navigate('/' + dest)} />
    </Suspense>
  );
  if (s.view === 'kalendarz') return (
    <Suspense fallback={<ViewFallback />}>
      <CalendarView session={session} onBack={s.goBack} onSyncCalendar={s.startGoogleAuth} onResyncCalendar={s.syncCalendar} isSyncing={s.isSyncing} onNavigateTo={dest => s.navigate('/' + dest)} />
    </Suspense>
  );
  if (s.view === 'sauna') return (
    <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
      <Suspense fallback={<ViewFallback />}>
        <SaunaLoggerModal onSaved={() => { s.refresh(); s.setWorkoutKey(k => k + 1); s.navigate('/dzis'); }} onBack={() => { s.refresh(); s.navigate('/dzis'); }} />
      </Suspense>
    </div>
  );
  if (s.view === 'trening') return (
    <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
      <Suspense fallback={<ViewFallback />}>
        <WorkoutLogger initial={s.workoutInitial} onSaved={() => { s.refresh(); s.setWorkoutKey(k => k + 1); s.navigate('/dzis'); }} onBack={() => { s.setWorkoutInitial(null); s.refresh(); s.navigate('/dzis'); }} />
      </Suspense>
    </div>
  );

  if (s.loading) return (
    <div className="min-h-screen bg-scrim flex items-center justify-center">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <Spinner size="lg" />
      </div>
    </div>
  );

  const navItems = [
    { id: 'dzis', icon: Sun, label: 'Dziś' },
    { id: 'tydzien', icon: Calendar, label: 'Tydzień' },
    { id: 'projekty', icon: FolderKanban, label: 'Projekty' },
    { id: 'historia', icon: Clock, label: 'Historia' },
  ];

  const weeklyReviewNudge = new Date().getDay() === 0 && !s.taskReviewDoneThisWeek && (
    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h4 className="text-sm font-black text-primary uppercase tracking-wider">Tygodniowy Przegląd Zadań</h4>
        <p className="text-xs text-text-secondary mt-0.5 break-words">Niedziela to czas na oczyszczenie skrzynki i audyt projektów.</p>
      </div>
      <Pressable onClick={() => s.setShowWeeklyReview(true)} className="shrink-0 px-3.5 py-2 bg-primary hover:bg-primary-hover text-on-accent rounded-xl text-xs font-black transition-colors btn-press shadow-sm">
        Rozpocznij
      </Pressable>
    </div>
  );

  const showLock = !s.todayWin;

  const fastCaptureItems = [
    { label: 'Dodaj Jedzenie', emoji: '🍎', color: 'var(--color-success)', action: () => s.setShowQuickFoodEntry(true) },
    { label: 'Zaloguj Trening', emoji: '🏋️', color: 'var(--color-warning)', action: () => { s.openWorkout(); } },
    { label: 'Zaloguj Saunę', emoji: '🧖', color: 'var(--color-warning)', action: () => s.navigate('/sauna') },
    { label: 'Zmierz Wzrok', emoji: '👁️', color: 'var(--legacy-color-007)', action: () => s.navigate('/optics') },
  ];

  return (
    <DashboardContext.Provider value={s}>
      <div className="min-h-screen bg-background text-text-primary selection:bg-primary/10 font-sans transition-colors duration-[var(--motion-slow)]">
        <div className="mx-auto flex min-h-screen w-full max-w-md lg:max-w-4xl flex-col overflow-x-hidden border-x border-border-custom bg-background/40 backdrop-blur-[var(--blur-3xl)] shadow-sm" style={{ paddingBottom: showLock ? 'var(--dashboard-padding-locked)' : 'var(--dashboard-padding-navigation)' }}>
          <DashboardHeader
            userId={userId}
            unreadCount={s.pendingActionCount}
            onAvatarLongPress={() => s.setActionCenterOpen(true)}
            onAvatarClick={() => s.navigate('/fundament')}
            theme={s.theme}
            toggleTheme={s.toggleTheme}
            showLock={showLock}
            view={s.view}
            onShortcutClick={dest => s.navigate('/' + dest)}
            onSearchClick={() => s.setShowSearch(true)}
            staleNoteCount={s.staleNoteCount}
            handleLogoPressStart={s.handleLogoPressStart}
            handleLogoPressEnd={s.handleLogoPressEnd}
          />

          <main className="flex-1 overflow-hidden vt-tab-main" onTouchStart={showLock ? undefined : s.handleMainTouchStart} onTouchEnd={showLock ? undefined : s.handleMainTouchEnd}>
            {showLock ? (
              <div className="p-5 pb-8 space-y-7 overflow-y-auto h-full">
                <OrientationFooter />
                {weeklyReviewNudge}
                <PowerList session={session} todayWin={s.todayWin} onUpdate={s.refresh} planDaySignal={s.planDaySignal} />
                {s.todayWin && isAfter20() && (
                  <Pressable onClick={() => s.setShowShutdown(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm font-black uppercase tracking-wider text-primary hover:bg-primary/20 active:scale-95 transition-all shadow-sm mt-4">
                    Domknij Dzień (Rytuał Wieczorny)
                  </Pressable>
                )}
              </div>
            ) : (
              <>
                <ErrorBoundary>
                  {s.view === 'dzis' && (
                    <Suspense fallback={<ViewFallback />}>
                      <DashboardDzisTab />
                    </Suspense>
                  )}
                </ErrorBoundary>
                <ErrorBoundary>
                  {s.view === 'tydzien' && (
                    <Suspense fallback={<ViewFallback />}>
                      <DashboardTydzienTab
                        weeklyCalories={s.weeklyCalories}
                        nutritionKey={s.nutritionKey} onOpenActionCenter={() => s.setActionCenterOpen(true)}
                      />
                    </Suspense>
                  )}
                </ErrorBoundary>
                <ErrorBoundary>
                  {s.view === 'historia' && (
                    <Suspense fallback={<ViewFallback />}>
                      <DashboardHistoriaTab
                        historySubTab={s.historySubTab}
                        onSetSubTab={s.setHistorySubTab}
                      />
                    </Suspense>
                  )}
                </ErrorBoundary>
                <ErrorBoundary>
                  {s.view === 'projekty' && (
                    <Suspense fallback={<ViewFallback />}>
                      <DashboardProjektyTab />
                    </Suspense>
                  )}
                </ErrorBoundary>
              </>
            )}
          </main>
        </div>

        {!showLock && (
          <>
            <DashboardFastCaptureMenu show={s.showFastCapture} onClose={() => s.setShowFastCapture(false)} items={fastCaptureItems} />
            <DashboardNavBar view={s.view} navigateTo={s.navigateTo} urgentTodoCount={s.urgentTodoCount} navItems={navItems} tabOrder={TAB_ORDER} />
            <DashboardFastCaptureFAB active={s.showFastCapture} onToggle={() => s.setShowFastCapture(v => !v)} />
          </>
        )}

        <DashboardModals
          showMorningPlan={s.showMorningPlan} setShowMorningPlan={s.setShowMorningPlan}
          morningPlanTargetDate={s.morningPlanTargetDate} setMorningPlanTargetDate={s.setMorningPlanTargetDate}
          showShutdown={s.showShutdown} setShowShutdown={s.setShowShutdown}
          showWeeklyReview={s.showWeeklyReview} setShowWeeklyReview={s.setShowWeeklyReview}
          setTaskReviewDoneThisWeek={s.setTaskReviewDoneThisWeek}
          showQuickFoodEntry={s.showQuickFoodEntry} setShowQuickFoodEntry={s.setShowQuickFoodEntry}
          foodEditEntry={s.foodEditEntry} setFoodEditEntry={s.setFoodEditEntry}
          actionCenterOpen={s.actionCenterOpen} setActionCenterOpen={s.setActionCenterOpen}
          reloadPendingActions={s.reloadPendingActions}
          refresh={s.refresh} setNutritionKey={s.setNutritionKey}
        />

        {s.showSearch && <SearchModal onClose={() => s.setShowSearch(false)} />}
      </div>
    </DashboardContext.Provider>
  );
}
