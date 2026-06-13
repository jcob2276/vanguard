import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  Calendar,
  CheckSquare,
  Clock,
  Dumbbell,
  Fingerprint,
  Moon,
  Play,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { useDashboardData } from '../../hooks/useDashboardData';
import AIInsight from '../ai/AIInsight';
import GoalsCard from '../lifestyle/GoalsCard';
import PowerList from '../lifestyle/PowerList';

const WorkoutLogger = lazy(() => import('../biometrics/WorkoutLogger'));
const Stats = lazy(() => import('./Stats'));
const Fundament = lazy(() => import('./Fundament'));
const DailyStrainCard = lazy(() => import('../biometrics/DailyStrainCard'));
const StravaWidget = lazy(() => import('../integrations/StravaWidget'));
const MuscleHeatmap = lazy(() => import('../biometrics/MuscleHeatmap'));
const Photos = lazy(() => import('../identity/Photos'));
const Direction = lazy(() => import('../lifestyle/Direction'));
const Career = lazy(() => import('../career/Career'));
const Todo = lazy(() => import('../todo/Todo'));

const TAB_ORDER = ['dzis', 'tydzien', 'historia', 'kariera'];

const normalizeView = (view) => {
  if (!view || view === 'workout' || view === 'mentor' || view === 'mirror' || view === 'body') return 'dzis';
  if (view === 'stream' || view === 'plan' || view === 'progress' || view === 'direction') return 'tydzien';
  if (view === 'stats' || view === 'photos') return 'historia';
  return view;
};

function ViewFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function CommandButton({ icon: Icon, label, eyebrow, onClick, tone = 'primary', disabled = false }) {
  const primary = tone === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-[20px] border p-4 text-left transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:transform-none cursor-pointer ${
        primary
          ? 'border-primary/10 bg-primary/[0.06] hover:bg-primary/[0.1] shadow-[0_8px_20px_rgba(79,70,229,0.05)]'
          : 'border-border-custom bg-surface backdrop-blur-md hover:border-primary/20 hover:bg-surface-solid hover:shadow-md'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${primary ? 'bg-primary/10 text-primary' : 'bg-text-primary/[0.03] text-text-secondary border border-border-custom'}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          {eyebrow && <p className={`text-[9px] font-bold uppercase tracking-[0.15em] ${primary ? 'text-primary/70' : 'text-text-muted'}`}>{eyebrow}</p>}
          <p className="truncate font-display text-[13px] font-black tracking-tight text-text-primary mt-0.5">{label}</p>
        </div>
      </div>
      {primary && (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-[0_2px_8px_rgba(79,70,229,0.3)]">
          <Play size={12} className="ml-0.5 shrink-0" fill="currentColor" />
        </div>
      )}
    </button>
  );
}

function YazioWeeklyCard({ weeklyCalories, weeklyBudget, syncYazio, isSyncing }) {
  const progress = weeklyBudget > 0 ? Math.min((weeklyCalories / weeklyBudget) * 100, 100) : 0;

  return (
    <section className="rounded-[24px] border border-border-custom bg-surface backdrop-blur-md p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted">Yazio weekly</p>
          <p className="mt-1 font-display text-[26px] font-black tracking-tight text-text-primary leading-none">
            {weeklyCalories}
            <span className="ml-1 text-[12px] font-semibold text-text-muted tracking-normal">/ {weeklyBudget} kcal</span>
          </p>
        </div>
        <button
          onClick={syncYazio}
          disabled={isSyncing}
          className="rounded-xl border border-border-custom bg-surface-solid/40 p-2.5 text-text-secondary transition-all hover:bg-surface-solid hover:text-text-primary active:scale-95 disabled:opacity-50 cursor-pointer"
          title="Sync Yazio"
        >
          <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border-custom">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 shadow-[0_2px_8px_rgba(249,115,22,0.15)] transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] font-medium text-text-muted">
        <span>Tydzień</span>
        <span className="font-bold text-text-secondary">{Math.round(progress)}% budżetu</span>
      </div>
    </section>
  );
}

const BORN = new Date('2002-07-06');

const FUEL = [
  "Przyszłe ty ma nadzieję,\nże dzisiejsze ty nie odpuści.",
  "Nie żałujesz decyzji które podjąłeś.\nTylko tych których nie podjąłeś.",
  "Za rok będziesz tu\nalbo znacznie dalej.\nTy decydujesz dziś.",
  "Każda wielka zmiana zaczęła się\nod jednego zwykłego dnia.",
  "Entuzjazm to nie nastrój.\nTo decyzja którą podejmujesz rano.",
  "Dyskomfort który czujesz\nto dowód że rośniesz.",
  "Nie musisz mieć ochoty.\nMusisz tylko zacząć.",
  "Jedyne o czym będziesz żałować\nto że nie zacząłeś wcześniej.",
  "Twoje najlepsze lata\nnie są za tobą.",
  "Za 5 lat docenisz\nkażdą decyzję którą podjąłeś dziś.",
  "To nie jest próba.\nTo jest twoje życie.",
  "Nikt za ciebie nie będzie żałował\nże nie spróbowałeś.",
];

function DayCounter() {
  const [lived] = useState(() => Math.floor((Date.now() - BORN.getTime()) / 86400000));
  const quote = FUEL[lived % FUEL.length];
  return (
    <div className="py-4.5 px-5 border-l-4 border-primary/50 bg-primary/[0.02] dark:bg-primary/[0.04] backdrop-blur-md rounded-r-[20px] my-2 shadow-sm">
      <p className="font-display text-[14.5px] font-medium leading-relaxed text-text-primary italic whitespace-pre-line">
        "{quote}"
      </p>
    </div>
  );
}

function ModalSheet({ isOpen, onClose, children }) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentY(0);
      setDragging(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e) => {
    setStartY(e.targetTouches[0].clientY);
    setDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!dragging) return;
    const diff = e.targetTouches[0].clientY - startY;
    if (diff > 0) {
      setCurrentY(diff);
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
    if (currentY > 150) {
      onClose();
    }
    setCurrentY(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45 backdrop-blur-xs transition-opacity duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Sheet */}
      <div 
        style={{ 
          transform: `translateY(${currentY}px)`,
          transition: dragging ? 'none' : 'transform 0.4s cubic-bezier(0.32, 0.94, 0.6, 1)'
        }}
        className="relative flex h-[92vh] w-full max-w-md mx-auto flex-col rounded-t-[32px] border-t border-x border-border-custom bg-background/98 backdrop-blur-2xl shadow-2xl overflow-hidden"
      >
        {/* Handle bar acting as drag handle */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-full py-4 shrink-0 flex justify-center items-center cursor-row-resize touch-none"
        >
          <div className="h-1.5 w-12 rounded-full bg-text-muted/30" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export const triggerHaptic = (pattern = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export default function Dashboard({ session }) {
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  const [view, setView] = useState(() => normalizeView(localStorage.getItem('vanguard_view')));
  const [slideDir, setSlideDir] = useState('right');
  const [showWorkoutLogger, setShowWorkoutLogger] = useState(false);
  const [showTodo, setShowTodo] = useState(false);
  const [showFundament, setShowFundament] = useState(false);
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

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const navigateTo = (newView) => {
    triggerHaptic(8);
    const fromIdx = TAB_ORDER.indexOf(view);
    const toIdx = TAB_ORDER.indexOf(newView);
    setSlideDir(toIdx >= fromIdx ? 'right' : 'left');
    setView(newView);
  };
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
    const call = async (fn, body = {}) => {
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

  const handleGoogleCallback = useCallback(async (code) => {
    setSyncing(true);
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
      if (res.success) {
        window.history.replaceState({}, document.title, '/');
        await syncCalendar();
      }
    } catch (err) {
      console.error('Google Auth Error:', err);
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

  const weeklyBudget = 12600;

  const navItems = [
    { id: 'dzis', icon: Sun, label: 'Dziś' },
    { id: 'tydzien', icon: Calendar, label: 'Tydzień' },
    { id: 'historia', icon: Clock, label: 'Historia' },
    { id: 'kariera', icon: Briefcase, label: 'Kariera' },
  ];

  const isAnySheetOpen = showTodo || showFundament || showWorkoutLogger;

  return (
    <div className={`min-h-screen text-text-primary selection:bg-primary/10 font-sans transition-colors duration-500 overflow-hidden ${
      isAnySheetOpen ? 'bg-black' : 'bg-background'
    }`}>
      <div className={`mx-auto flex min-h-screen max-w-md flex-col border-x border-border-custom bg-background/40 backdrop-blur-3xl pb-24 shadow-sm transition-all duration-500 cubic-bezier(0.32, 0.94, 0.6, 1) origin-top relative ${
        isAnySheetOpen ? 'scale-[0.93] rounded-t-[28px] translate-y-2 brightness-75 overflow-hidden' : ''
      }`}>
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
              onClick={syncAll}
              disabled={isSyncingAll}
              className="rounded-full border border-border-custom bg-surface-solid/40 dark:bg-white/[0.03] p-2.5 text-text-secondary transition-all hover:text-text-primary hover:bg-surface-solid active:scale-95 disabled:opacity-40 cursor-pointer"
              title="Sync wszystkiego (Oura + Yazio + Strava + Strain)"
            >
              <RefreshCw size={15} className={isSyncingAll ? 'animate-spin text-primary' : ''} />
            </button>
            <button 
              onClick={() => { triggerHaptic(10); setShowFundament(true); }} 
              className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer" 
              title="Fundament"
            >
              <Fingerprint size={15} />
            </button>
            <button 
              onClick={() => { triggerHaptic(10); setShowTodo(true); }} 
              className="rounded-full border border-border-custom bg-primary/[0.04] p-2.5 text-primary transition-all hover:bg-primary/10 active:scale-95 cursor-pointer" 
              title="To Do"
            >
              <CheckSquare size={15} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <div
            key={view}
            className={`p-5 pb-8 ${slideDir === 'right' ? 'animate-spring-right' : 'animate-spring-left'}`}
          >
          {view === 'dzis' && (
            <div className="space-y-7">
              <DayCounter />
              <GoalsCard session={session} />
              <DailyStrainCard session={session} />
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />
              <CommandButton
                icon={Dumbbell}
                eyebrow="Physical Protocol"
                label="Zaloguj trening"
                onClick={() => { triggerHaptic(10); setShowWorkoutLogger(true); }}
              />
            </div>
          )}

          {view === 'tydzien' && (
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <AIInsight session={session} />
                <YazioWeeklyCard
                  weeklyCalories={weeklyCalories}
                  weeklyBudget={weeklyBudget}
                  syncYazio={syncYazio}
                  isSyncing={isSyncing}
                />
                <Direction session={session} />
              </div>
            </Suspense>
          )}

          {view === 'historia' && (
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-7">
                <Stats session={session} runningSlot={<StravaWidget session={session} />} />
                <Photos session={session} />
                <MuscleHeatmap session={session} />
              </div>
            </Suspense>
          )}

          {view === 'kariera' && (
            <Suspense fallback={<ViewFallback />}>
              <Career session={session} />
            </Suspense>
          )}
          </div>
        </main>

        <nav className="fixed bottom-6 left-1/2 z-40 flex w-[90%] max-w-[360px] -translate-x-1/2 items-center justify-between rounded-full border border-border-custom bg-surface/80 p-1.5 shadow-[var(--shadow-nav)] backdrop-blur-xl">
          {/* Sliding background indicator pill */}
          <div 
            className="absolute top-1.5 bottom-1.5 rounded-full bg-primary/10 transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1)"
            style={{
              width: 'calc(25% - 3px)',
              left: `calc(${TAB_ORDER.indexOf(view) * 25}% + 1.5px)`,
            }}
          />
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`relative z-10 flex flex-1 flex-col items-center gap-1 rounded-full py-2.5 transition-all duration-300 active:scale-95 cursor-pointer ${
                view === item.id 
                  ? 'text-primary font-black' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <item.icon size={16} className={`transition-transform duration-300 ${view === item.id ? 'scale-110' : 'scale-100'}`} />
              <span className="text-[8px] font-black uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Global Modal Sheets (Todo, Fundament, WorkoutLogger) */}
        <ModalSheet isOpen={showTodo} onClose={() => setShowTodo(false)}>
          <Todo session={session} onBack={() => setShowTodo(false)} />
        </ModalSheet>

        <ModalSheet isOpen={showFundament} onClose={() => setShowFundament(false)}>
          <Fundament 
            session={session} 
            onBack={() => setShowFundament(false)} 
            onSyncCalendar={startGoogleAuth} 
            isSyncing={isSyncing} 
          />
        </ModalSheet>

        <ModalSheet isOpen={showWorkoutLogger} onClose={() => { setShowWorkoutLogger(false); refresh(); }}>
          <WorkoutLogger 
            session={session} 
            onBack={() => { setShowWorkoutLogger(false); refresh(); }} 
          />
        </ModalSheet>
      </div>
    </div>
  );
}
