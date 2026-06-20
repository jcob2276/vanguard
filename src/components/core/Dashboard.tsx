import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
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
  Play,
  RefreshCw,
  Sun,
  Paintbrush,
  Fingerprint,
  Bookmark,
  Zap,
  Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { useDashboardData } from '../../hooks/useDashboardData';
import { useHaptics } from '../../hooks/useHaptics';
import AIInsight from '../ai/AIInsight';
import GoalsCard from '../lifestyle/GoalsCard';
import PowerList from '../lifestyle/PowerList';
import { getTodayWarsaw } from '../../lib/date';
import CommandButton from './CommandButton';
import DayCounter from './DayCounter';
import NutritionCard from './NutritionCard';
import MorningRitualCard from './MorningRitualCard';

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
const Keep = lazy(() => import('../career/Keep'));
const MorningRitual = lazy(() => import('../lifestyle/MorningRitual'));
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

export default function Dashboard({ session }: { session: any }) {
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
  const [slideDir, setSlideDir] = useState('right');
  const [showWorkoutLogger, setShowWorkoutLogger] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Theme support
  const [theme, setTheme] = useState(() => localStorage.getItem('vanguard_theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('vanguard_theme', theme);
  }, [theme]);

  const haptics = useHaptics();
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Morning Ritual State
  const [ritualDates, setRitualDates] = useState<string[]>([]);
  const [focusIntention, setFocusIntention] = useState('');

  useEffect(() => {
    if (!userId) return;
    const fetchMorningRitualState = async () => {
      try {
        const { data } = await supabase
          .from('vanguard_preferences')
          .select('key, value')
          .eq('user_id', userId)
          .in('key', ['morning_ritual_dates', 'morning_last_lights_answer']);
        
        if (data) {
          const datesPref = data.find(p => p.key === 'morning_ritual_dates');
          if (datesPref) {
            try { setRitualDates(JSON.parse(datesPref.value)); } catch { /* ignore malformed pref */ }
          }
          const lastLightsPref = data.find(p => p.key === 'morning_last_lights_answer');
          if (lastLightsPref) {
            try {
              const parsed = JSON.parse(lastLightsPref.value);
              const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
              if (parsed && parsed.date === todayStr) {
                setFocusIntention(parsed.intention);
              } else {
                setFocusIntention('');
              }
            } catch { /* ignore malformed pref */ }
          } else {
            setFocusIntention('');
          }
        }
      } catch (err) {
        console.error('Failed to load morning ritual state in Dashboard:', err);
      }
    };
    fetchMorningRitualState();
  }, [userId, view]);

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
  const isCompletedToday = ritualDates.includes(todayStr);

  const calculateStreak = () => {
    if (ritualDates.length === 0) return 0;
    const sorted = [...ritualDates]
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime()); // Descending

    const yesterdayStr = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    
    const formattedDates = sorted.map(d => d.toISOString().split('T')[0]);
    if (!formattedDates.includes(todayStr) && !formattedDates.includes(yesterdayStr)) {
      return 0;
    }

    let streak = 0;
    let checkDate = new Date(formattedDates[0]);

    if (formattedDates[0] === yesterdayStr && !formattedDates.includes(todayStr)) {
      checkDate = new Date(yesterdayStr);
    }

    for (let i = 0; i < formattedDates.length; i++) {
      const expectedStr = checkDate.toISOString().split('T')[0];
      if (formattedDates.includes(expectedStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const streakCount = calculateStreak();

  const [reviewOverdueDays, setReviewOverdueDays] = useState<number | null>(null);
  const [urgentTodoCount, setUrgentTodoCount] = useState(0);
  const [nudgeKey, setNudgeKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const fetchNudgeData = async () => {
      try {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
        const [{ data: reviews }, { count: urgentCount }] = await Promise.all([
          (supabase as any).from('weekly_kpi_reviews').select('week_start').eq('user_id', userId).order('week_start', { ascending: false }).limit(1),
          supabase.from('todo_items').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open').or(`priority.eq.urgent,and(due_date.lte.${todayStr},due_date.not.is.null)`),
        ]);
        if (reviews) {
          if ((reviews as any[]).length > 0) {
            const last = new Date((reviews as any[])[0].week_start + 'T00:00:00');
            setReviewOverdueDays(Math.floor((Date.now() - last.getTime()) / 86400000));
          } else {
            setReviewOverdueDays(999);
          }
        }
        if (urgentCount != null) setUrgentTodoCount(urgentCount);
      } catch (e) { console.error('fetchNudgeData failed', e); }
    };
    fetchNudgeData();
  }, [userId, nudgeKey]);

  const [transitioning, setTransitioning] = useState(false);

  const navigateTo = useCallback((newView: string) => {
    if (newView === view) return;
    haptics.light();
    const fromIdx = TAB_ORDER.indexOf(view);
    const toIdx = TAB_ORDER.indexOf(newView);
    const dir = toIdx >= fromIdx ? 'right' : 'left';
    document.documentElement.dataset.slide = dir;
    setSlideDir(dir);
    if (supportsVT) {
      (document as any).startViewTransition(() => {
        flushSync(() => setView(newView));
      });
    } else {
      setTransitioning(true);
      setView(newView);
      setTimeout(() => setTransitioning(false), 400);
    }
  }, [view, haptics]);
  const { isSyncing, setSyncing } = useStore();
  const {
    weeklyCalories,
    todayWin,
    syncYazio,
    loading,
    refresh,
  } = useDashboardData();

  useEffect(() => {
    localStorage.setItem('vanguard_view', view);
  }, [view]);

  const syncAll = useCallback(async () => {
    if (isSyncingAll) return;
    setIsSyncingAll(true);
    const base = import.meta.env.VITE_SUPABASE_URL;
    const call = async (fn: string, body: any = {}) => {
      const res = await fetch(`${base}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error(`${fn} failed: ${p.error || res.status}`);
      }
    };
    try {
      // 1. Podstawowe źródła (Oura + Yazio)
      await Promise.all([
        call('sync-yazio', { userId, sync_history: true, days: 7 }),
        call('sync-oura', { userId }),
      ]);
      // 2. Pobranie szczegółowych serii Oura (zapisuje tętno do bazy)
      await Promise.all([
        call('sync-oura-enhanced', { userId, days: 2 }),
        call('sync-oura-timeseries', { userId, days: 2 }),
      ]);
      // 3. Pobranie aktywności ze Strava (nakłada tętno z Oura)
      await call('sync-strava', {});
      // 4. Przeliczenie obciążenia (strain)
      await call('compute-daily-strain', { userId, days: 2 });
      // 5. Odświeżenie widoku
      refresh();
    } catch (err) {
      console.error('[syncAll] error:', err);
    } finally {
      setIsSyncingAll(false);
    }
  }, [isSyncingAll, accessToken, userId, refresh]);

  const syncCalendar = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ userId })
      });
      refresh();
    } catch (err) {
      console.error('Calendar Sync Error:', err);
    } finally {
      setSyncing(false);
    }
  }, [accessToken, refresh, setSyncing, userId]);

  const handleGoogleCallback = useCallback(async (code: string) => {
    setSyncing(true);
    // Remove query params immediately to prevent infinite loop on re-renders/failures
    window.history.replaceState({}, document.title, window.location.pathname);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          userId,
          code,
          redirectUri: window.location.origin
        })
      });
      const res = await response.json();
      if (res?.success) {
        await syncCalendar();
      } else {
        console.error('Google Auth Error:', res?.error);
        alert('Błąd połączenia z Google: ' + (res?.error || 'Nieznany błąd'));
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      alert('Błąd połączenia z Google: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }, [accessToken, setSyncing, syncCalendar, userId]);

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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && userId) handleGoogleCallback(code);
  }, [handleGoogleCallback, userId]);

  if (view === 'fundament') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <Fundament session={session} onBack={() => setView(normalizeView(localStorage.getItem('vanguard_previous_view')) || 'dzis')} onSyncCalendar={startGoogleAuth} isSyncing={isSyncing} />
      </Suspense>
    );
  }

  if (view === 'keep') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <Keep
          session={session}
          onBack={() => setView(normalizeView(localStorage.getItem('vanguard_previous_view')) || 'dzis')}
          onNavigateTo={(dest) => setView(dest)}
        />
      </Suspense>
    );
  }

  if (view === 'todo') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <Todo
          session={session}
          onBack={() => setView(normalizeView(localStorage.getItem('vanguard_previous_view')) || 'dzis')}
          onNavigateTo={(dest) => setView(dest)}
        />
      </Suspense>
    );
  }

  if (view === 'links') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <LinksInbox
          session={session}
          onBack={() => setView(normalizeView(localStorage.getItem('vanguard_previous_view')) || 'dzis')}
          onNavigateTo={(dest) => setView(dest)}
        />
      </Suspense>
    );
  }

  if (view === 'morning-ritual') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <MorningRitual session={session} onBack={() => { setView(normalizeView(localStorage.getItem('vanguard_previous_view')) || 'dzis'); refresh(); }} />
      </Suspense>
    );
  }

  if (view === 'weekly-review') {
    return (
      <Suspense fallback={<ViewFallback />}>
        <WeeklyReview
          session={session}
          onBack={() => {
            setNudgeKey(k => k + 1);
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
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-border-custom bg-background/40 backdrop-blur-3xl shadow-sm" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}>
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
            <button
              onClick={() => { localStorage.setItem('vanguard_previous_view', view); setView('todo'); }}
              className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
              title="Zadania"
            >
              <CheckSquare size={15} />
            </button>
            <Link
              to="/keep"
              className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer"
              title="Notatki"
            >
              <Paintbrush size={15} />
            </Link>
            <button
              onClick={() => { localStorage.setItem('vanguard_previous_view', view); setView('links'); }}
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
          </div>
        </header>

        <main className="flex-1 overflow-hidden vt-tab-main">
          {/* Each tab is always mounted but hidden when inactive — prevents full remount/freeze on switch */}
          <div className={`p-5 pb-8 ${view === 'dzis' ? (supportsVT ? '' : slideDir === 'right' ? 'animate-spring-right' : 'animate-spring-left') : 'hidden'}`}>
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

              {/* <JedenPriorytetCard
                session={session}
                todayWin={todayWin}
                streak={streakCount}
                onUpdate={refresh}
                onOpenRitual={() => {
                  localStorage.setItem('vanguard_previous_view', view);
                  setView('morning-ritual');
                }}
              /> */}
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
                <CheckpointsCard session={session} onNavigateTo={(dest) => { localStorage.setItem('vanguard_previous_view', view); navigateTo(dest); }} />
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

          <div className={`p-5 pb-8 ${view === 'tydzien' ? (supportsVT ? '' : slideDir === 'right' ? 'animate-spring-right' : 'animate-spring-left') : 'hidden'}`}>
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

          <div className={`p-5 pb-8 ${view === 'historia' ? (supportsVT ? '' : slideDir === 'right' ? 'animate-spring-right' : 'animate-spring-left') : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <Stats session={session} runningSlot={<StravaWidget session={session} />} />
                <Photos session={session} />
                <MuscleHeatmap session={session} />
              </div>
            </Suspense>
          </div>

          <div className={`p-5 pb-8 ${view === 'projekty' ? (supportsVT ? '' : slideDir === 'right' ? 'animate-spring-right' : 'animate-spring-left') : 'hidden'}`}>
            <Suspense fallback={<ViewFallback />}>
              <Projects
                session={session}
                reviewOverdueDays={reviewOverdueDays}
                onNavigateTo={(dest) => {
                  localStorage.setItem('vanguard_previous_view', view);
                  setView(dest);
                }}
              />
            </Suspense>
          </div>
        </main>
      </div>

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
            disabled={transitioning}
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

    </div>
  );
}
