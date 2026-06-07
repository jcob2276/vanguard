import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Dumbbell,
  Fingerprint,
  Gauge,
  LogOut,
  Play,
  RefreshCw,
  Sparkles,
  Sun,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useDashboardData } from '../hooks/useDashboardData';
import AIInsight from './AIInsight';
import PowerList from './PowerList';

const WorkoutLogger = lazy(() => import('./WorkoutLogger'));
const Stats = lazy(() => import('./Stats'));
const Fundament = lazy(() => import('./Fundament'));
const DailyStrainCard = lazy(() => import('./DailyStrainCard'));
const StravaWidget = lazy(() => import('./StravaWidget'));
const MuscleHeatmap = lazy(() => import('./MuscleHeatmap'));
const Photos = lazy(() => import('./Photos'));
const Direction = lazy(() => import('./Direction'));

const TAB_ORDER = ['dzis', 'tydzien', 'historia'];

const normalizeView = (view) => {
  if (!view || view === 'workout' || view === 'mentor' || view === 'mirror' || view === 'body') return 'dzis';
  if (view === 'stream' || view === 'plan' || view === 'progress' || view === 'direction') return 'tydzien';
  if (view === 'stats' || view === 'photos') return 'historia';
  return view;
};

function SectionHeader({ title, detail }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-white">{title}</h2>
      {detail && <p className="text-[11px] font-semibold leading-relaxed text-white/40">{detail}</p>}
    </div>
  );
}

function ViewFallback() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function statusPalette(state, readiness) {
  const normalized = (state || '').toLowerCase();
  if (normalized.includes('red') || normalized.includes('critical') || readiness < 50) {
    return { rail: 'bg-red-400', text: 'text-red-300', soft: 'bg-red-400/10 border-red-400/20', label: 'Risk' };
  }
  if (normalized.includes('yellow') || normalized.includes('calibrating') || readiness < 70) {
    return { rail: 'bg-orange-400', text: 'text-orange-300', soft: 'bg-orange-400/10 border-orange-400/20', label: 'Watch' };
  }
  return { rail: 'bg-primary', text: 'text-primary', soft: 'bg-primary/10 border-primary/20', label: 'Ready' };
}

function StateBrief({ state, readiness, doneCount, hasWorkoutToday, weeklyCalories, weeklyBudget, onWorkoutClick }) {
  const palette = statusPalette(state, readiness);
  const displayState = state ? state.replaceAll('_', ' ') : 'Analysis Pending';
  const caloriePct = weeklyBudget > 0 ? Math.round((weeklyCalories / weeklyBudget) * 100) : 0;

  const signals = [
    { label: 'Readiness', value: readiness ? `${readiness}` : '—', icon: Gauge, clickable: false },
    { label: 'Plan', value: `${doneCount}/5`, icon: CheckCircle2, clickable: false },
    { label: 'Training', value: hasWorkoutToday ? 'Done' : 'Open', icon: Dumbbell, clickable: true },
    { label: 'Fuel', value: `${Math.min(caloriePct, 999)}%`, icon: Sparkles, clickable: false },
  ];

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-[linear-gradient(135deg,rgba(23,23,25,0.98),rgba(6,8,12,0.98))] p-4">
      <div className={`absolute left-0 top-0 h-full w-1 ${palette.rail}`} />
      <div className="flex items-start justify-between gap-4 pl-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] ${palette.soft} ${palette.text}`}>
              {palette.label}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/28">Today Briefing</span>
          </div>
          <h2 className="mt-3 text-[26px] font-black uppercase leading-none tracking-tight text-white">
            {displayState}
          </h2>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 text-primary">
          <Sparkles size={18} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {signals.map(({ label, value, icon: Icon, clickable }) => {
          const content = (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[7px] font-black uppercase tracking-widest text-white/25">{label}</span>
                <Icon size={10} className={clickable && !hasWorkoutToday ? "text-primary animate-pulse" : "text-white/22"} />
              </div>
              <p className={`text-[12px] font-black uppercase ${clickable && !hasWorkoutToday ? "text-primary" : "text-white/78"}`}>{value}</p>
            </>
          );

          if (clickable) {
            return (
              <button
                key={label}
                onClick={onWorkoutClick}
                className="rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all px-2.5 py-2 text-left w-full"
              >
                {content}
              </button>
            );
          }

          return (
            <div key={label} className="rounded-md border border-white/[0.055] bg-black/22 px-2.5 py-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CommandButton({ icon: Icon, label, eyebrow, onClick, tone = 'primary', disabled = false }) {
  const primary = tone === 'primary';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-all active:scale-[0.99] disabled:opacity-50 ${
        primary
          ? 'border-primary/25 bg-primary/10 hover:bg-primary/15'
          : 'border-white/[0.07] bg-neutral-950/80 hover:border-white/[0.14]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${primary ? 'bg-black/35 text-primary' : 'bg-white/[0.04] text-white/52'}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          {eyebrow && <p className={`text-[8px] font-black uppercase tracking-[0.18em] ${primary ? 'text-primary' : 'text-white/30'}`}>{eyebrow}</p>}
          <p className="truncate text-[12px] font-black uppercase tracking-[0.08em] text-white">{label}</p>
        </div>
      </div>
      {primary && <Play size={15} className="shrink-0 text-primary" fill="currentColor" />}
    </button>
  );
}

function YazioWeeklyCard({ weeklyCalories, weeklyBudget, syncYazio, isSyncing }) {
  const progress = weeklyBudget > 0 ? Math.min((weeklyCalories / weeklyBudget) * 100, 100) : 0;

  return (
    <section className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/32">Yazio weekly</p>
          <p className="mt-1 text-[22px] font-black tracking-tight text-white">
            {weeklyCalories}
            <span className="ml-1 text-[11px] text-white/25">/ {weeklyBudget} kcal</span>
          </p>
        </div>
        <button
          onClick={syncYazio}
          disabled={isSyncing}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2.5 text-white/45 transition-colors hover:text-white disabled:opacity-50"
          title="Sync Yazio"
        >
          <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.28)] transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-white/24">
        Tydzien - {Math.round(progress)}% budzetu
      </p>
    </section>
  );
}

const BORN = new Date('2002-07-06');
const LIFE_DAYS = 29200; // ~80 lat

function DayCounter() {
  const day = Math.floor((Date.now() - BORN.getTime()) / 86400000) + 1;
  const pct = (day / LIFE_DAYS) * 100;

  return (
    <div className="space-y-3 py-1">
      <p className="text-[64px] font-black leading-none tracking-tight text-white tabular-nums">
        {day.toLocaleString('pl-PL')}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-[2px] rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct.toFixed(2)}%` }} />
        </div>
        <span className="text-[9px] font-black tabular-nums text-white/30 shrink-0">{pct.toFixed(1)}%</span>
      </div>
      <p className="text-[11px] font-semibold text-white/35">Żaden się nie powtórzy.</p>
    </div>
  );
}

export default function Dashboard({ session }) {
  const userId = session?.user?.id;
  const accessToken = session?.access_token;
  const [view, setView] = useState(() => normalizeView(localStorage.getItem('vanguard_view')));
  const [slideDir, setSlideDir] = useState('right');
  const [showWorkoutLogger, setShowWorkoutLogger] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const navigateTo = (newView) => {
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
      if (!res.ok) console.warn(`[syncAll] ${fn} ${res.status}`);
    };
    try {
      // 1. źródła równolegle
      await Promise.all([
        call('sync-yazio', { userId, sync_history: true, days: 7 }),
        call('sync-strava', {}),
        call('sync-oura', { userId }),
      ]);
      // 2. warstwy pochodne Oura
      await Promise.all([
        call('sync-oura-enhanced', { userId, days: 2 }),
        call('sync-oura-timeseries', { userId, days: 2 }),
      ]);
      // 3. przelicz strain
      await call('compute-daily-strain', { userId, days: 2 });
      // 4. odśwież dane
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
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/youtube.readonly'
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
        <Fundament session={session} onBack={() => setView('mirror')} onSyncCalendar={startGoogleAuth} isSyncing={isSyncing} />
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
      <Suspense fallback={<ViewFallback />}>
        <WorkoutLogger session={session} onBack={() => { setShowWorkoutLogger(false); refresh(); }} />
      </Suspense>
    );
  }

  const weeklyBudget = 12600;

  const navItems = [
    { id: 'dzis', icon: Sun, label: 'Dziś' },
    { id: 'tydzien', icon: Calendar, label: 'Tydzień' },
    { id: 'historia', icon: Clock, label: 'Historia' },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="mx-auto flex min-h-screen max-w-md flex-col border-x border-white/5 pb-24">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-black/75 px-5 py-4 backdrop-blur-xl">
          <div>
            <h1 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Vanguard</h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{format(new Date(), 'EEEE, d MMMM')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={syncAll}
              disabled={isSyncingAll}
              className="rounded-full border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10 disabled:opacity-40"
              title="Sync wszystkiego (Oura + Yazio + Strava + Strain)"
            >
              <RefreshCw size={16} className={isSyncingAll ? 'animate-spin text-primary' : 'text-white/45'} />
            </button>
            <button onClick={() => setView('fundament')} className="rounded-full border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10" title="Fundament">
              <Fingerprint size={16} className="text-primary" />
            </button>
            <button onClick={() => supabase.auth.signOut()} className="rounded-full border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10" title="Wyloguj">
              <LogOut size={16} className="text-white/45" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <div
            key={view}
            className={`p-5 pb-8 animate-in fade-in duration-300 ${slideDir === 'right' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'}`}
          >
          {view === 'dzis' && (
            <div className="space-y-8">
              <DayCounter />
              <DailyStrainCard session={session} />
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />
              <CommandButton
                icon={Dumbbell}
                eyebrow="Physical Protocol"
                label="Zaloguj trening"
                onClick={() => setShowWorkoutLogger(true)}
              />
            </div>
          )}

          {view === 'tydzien' && (
            <Suspense fallback={<ViewFallback />}>
              <div className="space-y-8">
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
              <div className="space-y-8">
                <Stats session={session} runningSlot={<StravaWidget session={session} />} />
                <Photos session={session} />
                <MuscleHeatmap session={session} />
              </div>
            </Suspense>
          )}
          </div>
        </main>

        <nav className="fixed bottom-6 left-1/2 z-40 flex w-[90%] max-w-[360px] -translate-x-1/2 items-center justify-between rounded-full border border-white/10 bg-neutral-950/90 p-2 shadow-2xl backdrop-blur-2xl">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-full py-2 transition-all ${
                view === item.id ? 'scale-110 bg-white/5 text-primary' : 'text-white/40 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span className="text-[7px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
