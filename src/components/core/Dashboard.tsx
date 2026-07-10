import { Suspense, lazy } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sun, Calendar, FolderKanban, Clock } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { DashboardHeader } from './DashboardHeader';
import { DashboardNavBar } from './DashboardNavBar';
import { DashboardModals } from './DashboardModals';
import { DashboardDzisTab } from './DashboardDzisTab';
import { DashboardTydzienTab } from './DashboardTydzienTab';
import { DashboardHistoriaTab } from './DashboardHistoriaTab';
import { DashboardFastCaptureMenu, DashboardFastCaptureFAB } from './DashboardFastCapture';
import OrientationFooter from './OrientationFooter';
import { SpineGuideStrip } from './SpineGuideStrip';
import PowerList from '../lifestyle/PowerList';
import SearchModal from './SearchModal';
import { useDashboardState } from './hooks/useDashboardState';
import { markWorkoutSessionActive } from '../../lib/health/workoutLogging';

const WorkoutLogger   = lazy(() => import('../biometrics/WorkoutLogger'));
const SaunaLoggerModal = lazy(() => import('../biometrics/SaunaLoggerModal'));
const Fundament       = lazy(() => import('./Fundament'));
const Keep            = lazy(() => import('../notes/Keep'));
const Todo            = lazy(() => import('../todo/Todo'));
const LinksInbox      = lazy(() => import('../lifestyle/LinksInbox'));
const CalendarView    = lazy(() => import('../calendar/CalendarView'));
const Projects        = lazy(() => import('../projects/Projects'));

const TAB_ORDER = ['dzis', 'tydzien', 'projekty', 'historia'];

function ViewFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function isAfter20(): boolean {
  try {
    const h = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', hour: 'numeric', hour12: false }).format(new Date()), 10);
    return h >= 20;
  } catch { return new Date().getHours() >= 20; }
}

export default function Dashboard({ session }: { session: Session }) {
  const s = useDashboardState(session);
  const userId = session?.user?.id;

  // ── Full-screen route views ──
  if (s.view === 'fundament') return (
    <Suspense fallback={<ViewFallback />}>
      <Fundament session={session} onBack={s.goBack} onSyncCalendar={s.startGoogleAuth} isSyncing={s.isSyncing} />
    </Suspense>
  );
  if (s.view === 'keep') return (
    <Suspense fallback={<ViewFallback />}>
      <Keep session={session} onBack={s.goBack} onNavigateTo={dest => s.navigate('/' + dest)} />
    </Suspense>
  );
  if (s.view === 'todo') return (
    <Suspense fallback={<ViewFallback />}>
      <Todo onBack={() => { s.refreshNudge(); s.goBack(); }} onNavigateTo={dest => s.navigate('/' + dest)} />
    </Suspense>
  );
  if (s.view === 'links') return (
    <Suspense fallback={<ViewFallback />}>
      <LinksInbox session={session} onBack={s.goBack} onNavigateTo={dest => s.navigate('/' + dest)} />
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
        <SaunaLoggerModal session={session} onSaved={() => { s.refresh(); s.setWorkoutKey(k => k + 1); s.navigate('/dzis'); }} onBack={() => { s.refresh(); s.navigate('/dzis'); }} />
      </Suspense>
    </div>
  );
  if (s.view === 'trening') return (
    <div className="animate-ios-modal flex-1 flex flex-col min-h-screen">
      <Suspense fallback={<ViewFallback />}>
        <WorkoutLogger session={session} initial={s.workoutInitial} onSaved={() => { s.refresh(); s.setWorkoutKey(k => k + 1); s.navigate('/dzis'); }} onBack={() => { s.setWorkoutInitial(null); s.refresh(); s.navigate('/dzis'); }} />
      </Suspense>
    </div>
  );

  if (s.loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h4 className="text-[12px] font-black text-indigo-500 uppercase tracking-wider">Tygodniowy Przegląd Zadań</h4>
        <p className="text-[10px] text-text-secondary mt-0.5 break-words">Niedziela to czas na oczyszczenie skrzynki i audyt projektów.</p>
      </div>
      <button onClick={() => s.setShowWeeklyReview(true)} className="shrink-0 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black transition-colors btn-press shadow-sm">
        Rozpocznij
      </button>
    </div>
  );

  const showLock = !s.todayWin;

  const fastCaptureItems = [
    { label: 'Dodaj Jedzenie', emoji: '🍎', color: 'border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5', action: () => s.setShowQuickFoodEntry(true) },
    { label: 'Zaloguj Trening', emoji: '🏋️', color: 'border-orange-500/20 text-orange-500 hover:bg-orange-500/5', action: () => { s.openWorkout(); } },
    { label: 'Zaloguj Saunę', emoji: '🧖', color: 'border-amber-500/20 text-amber-500 hover:bg-amber-500/5', action: () => s.navigate('/sauna') },
    { label: 'Zmierz Wzrok', emoji: '👁️', color: 'border-teal-500/20 text-teal-500 hover:bg-teal-500/5', action: () => s.navigate('/optics') },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-primary/10 font-sans transition-colors duration-300">
      <div className="mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden border-x border-border-custom bg-background/40 backdrop-blur-3xl shadow-sm" style={{ paddingBottom: showLock ? '2rem' : 'calc(6rem + env(safe-area-inset-bottom))' }}>
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
              <OrientationFooter session={session} />
              <SpineGuideStrip guidance={s.spineGuidance} loading={s.spineGuidanceLoading} onNavigate={s.handleSpineGuideNavigate} onPlanDay={s.handlePlanDay} onFocusPlan={s.handleFocusPlan} />
              {weeklyReviewNudge}
              <PowerList session={session} todayWin={s.todayWin} onUpdate={s.refresh} planDaySignal={s.planDaySignal} />
              {s.todayWin && isAfter20() && (
                <button onClick={() => s.setShowShutdown(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm font-black uppercase tracking-wider text-indigo-500 hover:bg-indigo-500/20 active:scale-95 transition-all shadow-sm mt-4">
                  Domknij Dzień (Rytuał Wieczorny)
                </button>
              )}
            </div>
          ) : (
            <>
              <ErrorBoundary>
                {s.view === 'dzis' && (
                  <DashboardDzisTab
                    todayWin={s.todayWin}
                    spineGuidance={s.spineGuidance} spineGuidanceLoading={s.spineGuidanceLoading}
                    weeklyReviewNudge={weeklyReviewNudge} planDaySignal={s.planDaySignal}
                    nutritionKey={s.nutritionKey} workoutKey={s.workoutKey}
                    onRefresh={s.refresh} onSetNutritionKey={s.setNutritionKey}
                    onOpenFoodModal={() => s.setShowQuickFoodEntry(true)}
                    onOpenShutdown={() => s.setShowShutdown(true)}
                    onSpineGuideNavigate={s.handleSpineGuideNavigate}
                    onPlanDay={s.handlePlanDay} onFocusPlan={s.handleFocusPlan}
                  />
                )}
              </ErrorBoundary>
              <ErrorBoundary>
                {s.view === 'tydzien' && (
                  <DashboardTydzienTab
                    weeklyCalories={s.weeklyCalories}
                    nutritionKey={s.nutritionKey} onOpenActionCenter={() => s.setActionCenterOpen(true)}
                  />
                )}
              </ErrorBoundary>
              <ErrorBoundary>
                {s.view === 'historia' && (
                  <DashboardHistoriaTab
                    historySubTab={s.historySubTab}
                    onSetSubTab={s.setHistorySubTab}
                  />
                )}
              </ErrorBoundary>
              <ErrorBoundary>
                {s.view === 'projekty' && (
                  <div className="p-5 pb-8">
                    <Suspense fallback={<ViewFallback />}>
                      <Projects reviewOverdueDays={s.reviewOverdueDays} onNavigateTo={dest => s.navigate('/' + dest)} />
                    </Suspense>
                  </div>
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
        session={session}
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

      {s.showSearch && <SearchModal session={session} onClose={() => s.setShowSearch(false)} />}
    </div>
  );
}
