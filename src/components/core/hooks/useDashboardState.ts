import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { flushSync } from 'react-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../store/useStore';
import { useDashboardData } from './useDashboardData';
import { getTodayWarsaw, TIMEZONE } from '../../../lib/date';
import { useHaptics } from '../../../hooks/useHaptics';
import { useNudgeData } from './useNudgeData';
import { useSyncActions } from '../../../hooks/useSyncActions';
import { useSpineGuidance } from '../../growth/hooks/useSpineGuidance';
import { usePendingActionCount } from '../../../components/shared/ActionCenterSheet';
import { useWorkoutResume } from '../../biometrics/hooks/useWorkoutResume';
import { useDashboardSwipeNav } from './useDashboardSwipeNav';
import { fetchLatestTaskReviewDate } from '../../../lib/todo/todo';
import { getWeekStartWarsaw } from '../../../lib/growth/growth';
import type { WorkoutLoggerInitial } from '../../../lib/health/workoutLogging';
import { markWorkoutSessionActive } from '../../../lib/health/workoutLogging';
import type { RecentEntry } from '../nutrition/hooks/useFoodEntryData';
import type { SpineGuideTarget } from '../../../lib/goal/goalSpineGuide';

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

export function useDashboardState(session: Session) {
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  const location = useLocation();
  const navigate = useNavigate();
  const haptics = useHaptics();

  const rawView = location.pathname === '/' ? 'dzis' : location.pathname.substring(1);
  const view = normalizeView(rawView);

  // URL param redirects
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
      const shared = `${params.get('share_url') || ''} ${params.get('share_text') || ''}`;
      const hasUrl = /https?:\/\/[^\s]+/.test(shared);
      navigate({ pathname: hasUrl ? '/links' : '/keep', search: location.search }, { replace: true });
    }
  }, [location.search, navigate]);

  // Modal visibility state
  const [actionCenterOpen, setActionCenterOpen]     = useState(false);
  const [historySubTab, setHistorySubTab]           = useState<'chronicle' | 'bio'>('chronicle');
  const [workoutInitial, setWorkoutInitial]         = useState<WorkoutLoggerInitial | null>(null);
  const [workoutKey, setWorkoutKey]                 = useState(0);
  const [showMorningPlan, setShowMorningPlan]       = useState(false);
  const [morningPlanTargetDate, setMorningPlanTargetDate] = useState<string | null>(null);
  const [showShutdown, setShowShutdown]             = useState(false);
  const [showWeeklyReview, setShowWeeklyReview]     = useState(false);
  const [taskReviewDoneThisWeek, setTaskReviewDoneThisWeek] = useState(false);
  const [showSearch, setShowSearch]                 = useState(false);
  const [showQuickFoodEntry, setShowQuickFoodEntry] = useState(false);
  const [showFastCapture, setShowFastCapture]       = useState(false);
  const [nutritionKey, setNutritionKey]             = useState(0);
  const [foodEditEntry, setFoodEditEntry]           = useState<RecentEntry | null>(null);
  const [planDaySignal, setPlanDaySignal]           = useState(0);

  // --- Browser back button modal support state ---
  const openModal = showMorningPlan
    ? 'morningPlan'
    : showShutdown
    ? 'shutdown'
    : showWeeklyReview
    ? 'weeklyReview'
    : showQuickFoodEntry
    ? 'quickFoodEntry'
    : actionCenterOpen
    ? 'actionCenter'
    : showSearch
    ? 'search'
    : showFastCapture
    ? 'fastCapture'
    : null;

  const lastOpenModalRef = useRef<string | null>(null);
  const isPopStateRef = useRef(false);

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('vanguard_theme') || 'light');
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try { localStorage.setItem('vanguard_theme', theme); } catch (e: unknown) {
      console.warn('[useDashboardState] Failed to save theme to localStorage:', e);
    }
  }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Keyboard shortcuts (Cmd+K for search, ESC to close, N for capture, F for food)
  useEffect(() => {
    const isTyping = () => {
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || active.hasAttribute('contenteditable') || active.getAttribute('contenteditable') === 'true';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // 1. Search shortcut (Cmd+K or Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
        return;
      }

      // 2. Escape shortcut to close any open modal
      if (e.key === 'Escape') {
        if (openModal) {
          e.preventDefault();
          setShowMorningPlan(false);
          setShowShutdown(false);
          setShowWeeklyReview(false);
          setShowQuickFoodEntry(false);
          setActionCenterOpen(false);
          setShowSearch(false);
          setShowFastCapture(false);
          setFoodEditEntry(null);
        }
        return;
      }

      // 3. Letter shortcuts (N for Fast Capture, F for Food Entry)
      if (isTyping() || openModal) {
        return;
      }

      if (key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowFastCapture(true);
      } else if (key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowQuickFoodEntry(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openModal]);

  // View event tracking
  // Note: viewEventMutation identity changes on every status transition (idle/pending/success).
  // We store the mutate fn in a ref so the effect below only re-fires when userId or view
  // actually changes — not on every mutation lifecycle tick. This prevents an infinite
  // insert loop into view_events (seen at 87k+ rows when the mutation was in the deps array).
  const viewEventMutation = useMutation({
    mutationFn: async (viewName: string) => {
      if (!userId) return;
      const { error } = await supabase.from('view_events').insert({ user_id: userId, view_name: viewName });
      if (error) throw error;
    }
  });
  const viewEventMutateRef = useRef(viewEventMutation.mutate);
  useEffect(() => { viewEventMutateRef.current = viewEventMutation.mutate; });

  useEffect(() => {
    if (userId && view) {
      viewEventMutateRef.current(view);
    }
  }, [userId, view]);

  // Task review status
  const { data: latestTaskReviewDate } = useQuery({
    queryKey: ['latest-task-review-date', userId],
    queryFn: () => fetchLatestTaskReviewDate(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (latestTaskReviewDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate sync of react-query data to local state
      setTaskReviewDoneThisWeek(getWeekStartWarsaw(latestTaskReviewDate) === getWeekStartWarsaw(getTodayWarsaw()));
    }
  }, [latestTaskReviewDate]);

  // Meal deep link
  useEffect(() => {
    if (new URLSearchParams(location.search).get('meal') === 'new') {
      navigate('/', { replace: true });
      window.setTimeout(() => setShowQuickFoodEntry(true), 0);
    }
  }, [location.search, navigate]);

  // Logo long-press → food entry
  const logoLongPressTimer = useRef<number | null>(null);
  const logoLongPressFired = useRef(false);
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

  // Data
  const { count: pendingActionCount, reload: reloadPendingActions } = usePendingActionCount(session);
  const { isSyncing, setSyncing } = useStore();
  const { weeklyCalories, todayWin, loading, refresh } = useDashboardData(session);
  const { guidance: spineGuidance, loading: spineGuidanceLoading } = useSpineGuidance(userId, todayWin);
  const { syncCalendar, startGoogleAuth } = useSyncActions({ userId, accessToken, onRefresh: refresh, setSyncing });
  const { reviewOverdueDays, urgentTodoCount, staleNoteCount, refresh: refreshNudge } = useNudgeData(userId);

  // Auto-suggest Evening Shutdown after 20:00 Warsaw
  useEffect(() => {
    if (!todayWin) return;
    if (todayWin.day_note?.trim()) return;
    const today = getTodayWarsaw();
    try {
      if (localStorage.getItem('vanguard_shutdown_dismissed') === today) return;
    } catch (e: unknown) { console.warn('[useDashboardState] Failed to read shutdown dismissed date from localStorage:', e); }
    const warsawHour = parseInt(
      new Date().toLocaleTimeString('en-CA', { timeZone: TIMEZONE, hour: 'numeric', hour12: false }),
      10
    );
    if (warsawHour >= 20) { setTimeout(() => setShowShutdown(true), 0); }
  }, [todayWin]);

  // Navigation
  useWorkoutResume(userId, useCallback(() => {
    if (location.pathname !== '/trening') { navigate('/trening'); }
  }, [location.pathname, navigate]));

  const navigateTo = useCallback((newView: string) => {
    if (newView === view) return;
    haptics.light();
    const fromIdx = TAB_ORDER.indexOf(view);
    const toIdx   = TAB_ORDER.indexOf(newView);
    document.documentElement.dataset.slide = toIdx >= fromIdx ? 'right' : 'left';
    const path = '/' + newView;
    if (supportsVT) {
      (document as unknown as { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => { flushSync(() => navigate(path)); });
    } else {
      navigate(path);
    }
  }, [view, haptics, navigate]);

  const { handleMainTouchStart, handleMainTouchEnd } = useDashboardSwipeNav({ view, navigateTo, tabOrder: TAB_ORDER });

  const handleSpineGuideNavigate = useCallback((target: SpineGuideTarget) => {
    if (target === 'dashboard') { navigate('/dashboard'); return; }
    navigateTo(target);
  }, [navigate, navigateTo]);

  const goBack = useCallback(() => { haptics.light(); navigate('/dzis'); }, [haptics, navigate]);
  const handlePlanDay = useCallback(() => { haptics.light(); setShowMorningPlan(true); setPlanDaySignal(n => n + 1); }, [haptics]);
  const handleFocusPlan = useCallback(() => { haptics.light(); document.getElementById('day-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [haptics]);

  const openWorkout = useCallback(() => {
    setWorkoutInitial(null);
    if (userId) markWorkoutSessionActive(userId);
    navigate('/trening');
  }, [userId, navigate]);

  // --- Browser back button modal support effects ---

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      isPopStateRef.current = true;
      const modalInState = e.state?.modal;

      // Close all modals
      setShowMorningPlan(false);
      setShowShutdown(false);
      setShowWeeklyReview(false);
      setShowQuickFoodEntry(false);
      setActionCenterOpen(false);
      setShowSearch(false);
      setShowFastCapture(false);
      setFoodEditEntry(null);

      // Open the one in state, if any
      if (modalInState) {
        if (modalInState === 'morningPlan') setShowMorningPlan(true);
        else if (modalInState === 'shutdown') setShowShutdown(true);
        else if (modalInState === 'weeklyReview') setShowWeeklyReview(true);
        else if (modalInState === 'quickFoodEntry') setShowQuickFoodEntry(true);
        else if (modalInState === 'actionCenter') setActionCenterOpen(true);
        else if (modalInState === 'search') setShowSearch(true);
        else if (modalInState === 'fastCapture') setShowFastCapture(true);
      }

      lastOpenModalRef.current = modalInState || null;
      isPopStateRef.current = false;
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const prev = lastOpenModalRef.current;
    const curr = openModal;

    if (prev === curr) return;

    if (isPopStateRef.current) {
      lastOpenModalRef.current = curr;
      return;
    }

    if (curr && !prev) {
      window.history.pushState({ modal: curr }, '');
    } else if (!curr && prev) {
      window.history.back();
    } else if (curr && prev && curr !== prev) {
      window.history.replaceState({ modal: curr }, '');
    }

    lastOpenModalRef.current = curr;
  }, [openModal]);

  return {
    // routing
    view, navigate, goBack, navigateTo,
    location, handleMainTouchStart, handleMainTouchEnd,
    // data
    weeklyCalories, todayWin, loading, refresh,
    spineGuidance, spineGuidanceLoading,
    reviewOverdueDays, urgentTodoCount, staleNoteCount, refreshNudge,
    pendingActionCount, reloadPendingActions,
    isSyncing, syncCalendar, startGoogleAuth,
    // state
    theme, toggleTheme,
    actionCenterOpen, setActionCenterOpen,
    historySubTab, setHistorySubTab,
    workoutInitial, setWorkoutInitial, workoutKey, setWorkoutKey,
    showMorningPlan, setShowMorningPlan,
    morningPlanTargetDate, setMorningPlanTargetDate,
    showShutdown, setShowShutdown,
    showWeeklyReview, setShowWeeklyReview,
    taskReviewDoneThisWeek, setTaskReviewDoneThisWeek,
    showSearch, setShowSearch,
    showQuickFoodEntry, setShowQuickFoodEntry,
    showFastCapture, setShowFastCapture,
    nutritionKey, setNutritionKey,
    foodEditEntry, setFoodEditEntry,
    planDaySignal,
    // handlers
    handleLogoPressStart, handleLogoPressEnd,
    handleSpineGuideNavigate, handlePlanDay, handleFocusPlan,
    openWorkout,
  };
}
