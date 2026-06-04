import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  Brain,
  Camera,
  CheckCircle2,
  Dumbbell,
  Fingerprint,
  Gauge,
  Layout,
  LogOut,
  Play,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useDashboardData } from '../hooks/useDashboardData';
import WorkoutLogger from './WorkoutLogger';
import Stats from './Stats';
import Fundament from './Fundament';
import OuraWidget from './OuraWidget';
import DailyStrainCard from './DailyStrainCard';
import StravaWidget from './StravaWidget';
import AIInsight from './AIInsight';
import MuscleHeatmap from './MuscleHeatmap';
import Photos from './Photos';
import Direction from './Direction';
import PowerList from './PowerList';
import IntentionTracker from './IntentionTracker';

const normalizeView = (view) => {
  if (!view || view === 'workout' || view === 'mentor') return 'mirror';
  if (view === 'stream' || view === 'plan') return 'mirror';
  if (view === 'stats') return 'body';
  if (view === 'direction') return 'progress';
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

export default function Dashboard({ session }) {
  const [view, setView] = useState(() => normalizeView(localStorage.getItem('vanguard_view')));
  const [showWorkoutLogger, setShowWorkoutLogger] = useState(false);
  const { isSyncing, setSyncing } = useStore();
  const {
    weeklyCalories,
    todayWin,
    syncYazio,
    loading,
    refresh,
    readiness,
    stability,
    operationalState,
    hasWorkoutToday
  } = useDashboardData();

  useEffect(() => {
    localStorage.setItem('vanguard_view', view);
  }, [view]);

  async function handleGoogleCallback(code) {
    setSyncing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: session.user.id,
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
  }

  async function syncCalendar() {
    setSyncing(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-calendar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: session?.user?.id })
      });
      refresh();
    } catch (err) {
      console.error('Calendar Sync Error:', err);
    } finally {
      setSyncing(false);
    }
  }

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
    if (code && session) handleGoogleCallback(code);
  }, [session]);

  if (view === 'fundament') {
    return <Fundament session={session} onBack={() => setView('mirror')} onSyncCalendar={startGoogleAuth} isSyncing={isSyncing} />;
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
    return <WorkoutLogger session={session} onBack={() => { setShowWorkoutLogger(false); refresh(); }} />;
  }

  const doneCount = todayWin ? [1, 2, 3, 4, 5].filter((i) => todayWin[`done_${i}`]).length : 0;
  const weeklyBudget = 12600;

  const navItems = [
    { id: 'mirror', icon: Layout, label: 'Mirror' },
    { id: 'body', icon: Activity, label: 'Body' },
    { id: 'progress', icon: Brain, label: 'Progress' },
    { id: 'photos', icon: Camera, label: 'Photos' }
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
            <button onClick={() => setView('fundament')} className="rounded-full border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10" title="Fundament">
              <Fingerprint size={16} className="text-primary" />
            </button>
            <button onClick={() => supabase.auth.signOut()} className="rounded-full border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10" title="Wyloguj">
              <LogOut size={16} className="text-white/45" />
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-5 animate-in fade-in duration-500">
          {view === 'mirror' && (
            <>
              <section className="space-y-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary">System Mirror</p>
                  <h2 className="mt-1 text-[18px] font-black uppercase tracking-tight text-white">Briefing operacyjny</h2>
                </div>
                <StateBrief
                  state={operationalState}
                  readiness={readiness}
                  doneCount={doneCount}
                  hasWorkoutToday={hasWorkoutToday}
                  weeklyCalories={weeklyCalories}
                  weeklyBudget={weeklyBudget}
                  onWorkoutClick={() => setShowWorkoutLogger(true)}
                />
              </section>

              <AIInsight session={session} />

              <section className="space-y-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35">Next Move</p>
                    <h2 className="mt-1 text-[15px] font-black uppercase tracking-tight text-white">Jedna akcja teraz</h2>
                  </div>
                  <p className="pb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/24">Command Area</p>
                </div>
                <CommandButton
                  icon={Dumbbell}
                  eyebrow="Physical Protocol"
                  label="Zaloguj trening"
                  onClick={() => setShowWorkoutLogger(true)}
                />
              </section>

              <section className="space-y-4 pt-2">
                <IntentionTracker
                  session={session}
                  todayWin={todayWin}
                  stability={stability}
                  operationalState={operationalState}
                />
                <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />
              </section>
            </>
          )}

          {view === 'body' && (
            <section className="space-y-5">
              <SectionHeader title="Body" detail="Pomiary, regeneracja i podstawowe sygnały. Bez wykresów dla wykresów." />
              <DailyStrainCard session={session} />
              <Stats
                session={session}
                topSlot={(
                  <>
                    <YazioWeeklyCard
                      weeklyCalories={weeklyCalories}
                      weeklyBudget={weeklyBudget}
                      syncYazio={syncYazio}
                      isSyncing={isSyncing}
                    />
                    <OuraWidget session={session} />
                  </>
                )}
                runningSlot={<StravaWidget session={session} />}
              />
            </section>
          )}

          {view === 'progress' && (
            <section className="space-y-4">
              <SectionHeader
                title="Progress"
                detail="Tu wraca postęp, tygodniowe wykrywanie, kierunek i wzorce. Nie jest to czat, tylko przegląd trajektorii."
              />
              <Direction session={session} />
            </section>
          )}

          {view === 'photos' && (
            <section className="space-y-5">
              <Photos session={session} />
              <MuscleHeatmap session={session} />
            </section>
          )}
        </main>

        <nav className="fixed bottom-6 left-1/2 z-40 flex w-[90%] max-w-[360px] -translate-x-1/2 items-center justify-between rounded-full border border-white/10 bg-neutral-950/90 p-2 shadow-2xl backdrop-blur-2xl">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
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
