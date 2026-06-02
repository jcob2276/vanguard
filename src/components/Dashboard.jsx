import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  BarChart2,
  Brain,
  Calendar,
  Camera,
  Dumbbell,
  Fingerprint,
  Layout,
  LogOut,
  Play,
  RefreshCw,
  RotateCw,
  Sparkles,
  Target,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useDashboardData } from '../hooks/useDashboardData';
import WorkoutLogger from './WorkoutLogger';
import Stats from './Stats';
import Fundament from './Fundament';
import OuraWidget from './OuraWidget';
import StravaWidget from './StravaWidget';
import AIInsight from './AIInsight';
import GraphMind from './GraphMind';
import Photos from './Photos';
import Direction from './Direction';
import PowerList from './PowerList';
import IntentionTracker from './IntentionTracker';

const normalizeView = (view) => {
  if (!view || view === 'workout' || view === 'mentor') return 'mirror';
  if (view === 'stream') return 'plan';
  if (view === 'stats') return 'body';
  if (view === 'direction') return 'progress';
  return view;
};

function MetricTile({ label, value, tone = 'text-white', icon: Icon }) {
  return (
    <div className="bg-neutral-950/70 border border-white/5 rounded-2xl p-4 min-h-[92px] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-[8px] font-black text-white/35 uppercase tracking-[0.18em]">{label}</p>
        {Icon && <Icon size={14} className="text-white/25" />}
      </div>
      <p className={`text-lg font-black italic uppercase tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

function SectionHeader({ title, detail }) {
  return (
    <div className="space-y-1">
      <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-white">{title}</h2>
      {detail && <p className="text-[11px] font-semibold leading-relaxed text-white/40">{detail}</p>}
    </div>
  );
}

function PlanningGuide() {
  const prompts = [
    '1 rzecz dla kierunku: sprzedaż / cyber / pieniądze',
    '1 rzecz dla ciała: siłownia / kroki / sen / jedzenie',
    '1 zaległość, której unikasz',
    '1 relacja lub odważny kontakt',
    '1 zamknięcie dnia: porządek / pakowanie / plan jutra'
  ];

  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Target size={15} className="text-primary" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary">Co wpisać do 5 rzeczy</p>
      </div>
      <div className="space-y-2">
        {prompts.map((prompt) => (
          <div key={prompt} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
            <p className="text-[11px] font-bold leading-relaxed text-white/70">{prompt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ session }) {
  const [view, setView] = useState(() => normalizeView(localStorage.getItem('vanguard_view')));
  const [showWorkoutLogger, setShowWorkoutLogger] = useState(false);
  const [selectedDataTab, setSelectedDataTab] = useState(() => localStorage.getItem('vanguard_data_tab') || 'charts');
  const { isSyncing, setSyncing } = useStore();
  const {
    weeklyCalories,
    todayWin,
    syncYazio,
    loading,
    refresh,
    readiness,
    stability,
    operationalState
  } = useDashboardData();

  useEffect(() => {
    localStorage.setItem('vanguard_view', view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('vanguard_data_tab', selectedDataTab);
  }, [selectedDataTab]);

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

  if (view === 'fundament') return <Fundament session={session} onBack={() => setView('mirror')} />;

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
  const focusText = doneCount >= 4 ? 'High' : doneCount >= 2 ? 'Medium' : 'Low';
  const recoveryText = readiness >= 85 ? 'Optimal' : readiness >= 70 ? 'Stable' : readiness >= 50 ? 'Fair' : readiness > 0 ? 'Low' : 'No data';
  const focusTone = doneCount >= 4 ? 'text-primary' : doneCount >= 2 ? 'text-orange-400' : 'text-red-400';
  const recoveryTone = readiness >= 70 ? 'text-primary' : readiness > 0 ? 'text-orange-400' : 'text-white/35';
  const stabilityTone = stability >= 80 ? 'text-primary' : stability >= 50 ? 'text-orange-400' : 'text-red-400';
  const weeklyBudget = 12600;

  const navItems = [
    { id: 'mirror', icon: Layout, label: 'Mirror' },
    { id: 'plan', icon: Target, label: 'Plan' },
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
            <button onClick={startGoogleAuth} className="rounded-full border border-white/5 bg-white/5 p-2.5 transition-colors hover:bg-white/10" title="Synchronizuj kalendarz">
              <Calendar size={16} className="text-white/45" />
            </button>
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
              <section className="space-y-4">
                <SectionHeader
                  title="System Mirror"
                  detail="Pierwszy ekran ma pokazać stan, ale system nadal opiera się na planie dnia, ciele, treningu, zdjęciach i tygodniowym postępie."
                />

                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 p-5">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Current State</p>
                      <h2 className="text-3xl font-black uppercase italic tracking-tight">
                        {operationalState ? operationalState.replace('_', ' ') : 'Analysis Pending'}
                      </h2>
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3">
                      <Sparkles size={20} className="text-primary" />
                    </div>
                  </div>
                </div>

                <AIInsight session={session} />
              </section>

              <section className="grid grid-cols-3 gap-3">
                <MetricTile label="Focus" value={focusText} tone={focusTone} icon={Zap} />
                <MetricTile label="Recovery" value={recoveryText} tone={recoveryTone} icon={Activity} />
                <MetricTile label="Stability" value={`${stability}%`} tone={stabilityTone} icon={Brain} />
              </section>

              <section className="space-y-3">
                <SectionHeader title="Next Move" detail="Jedna akcja, nie kolejna lista do ręcznego uzupełniania." />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowWorkoutLogger(true)}
                    className="col-span-2 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 p-4 text-left transition-colors hover:bg-primary/15"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/35 text-primary">
                        <Dumbbell size={22} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-primary">Physical Protocol</p>
                        <p className="text-sm font-black uppercase italic">Zaloguj Trening</p>
                      </div>
                    </div>
                    <Play size={16} className="text-primary" fill="currentColor" />
                  </button>

                  <button
                    onClick={() => setView('plan')}
                    className="rounded-2xl border border-white/5 bg-neutral-950 p-4 text-left transition-colors hover:border-primary/30"
                  >
                    <Target size={17} className="mb-3 text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">Ustaw 5 rzeczy</p>
                  </button>

                  <button
                    onClick={syncYazio}
                    disabled={isSyncing}
                    className="rounded-2xl border border-white/5 bg-neutral-950 p-4 text-left transition-colors hover:border-orange-500/30"
                  >
                    <RotateCw size={17} className={`mb-3 text-orange-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">Sync Yazio</p>
                  </button>
                </div>
              </section>
            </>
          )}

          {view === 'plan' && (
            <section className="space-y-4">
              <SectionHeader
                title="Plan dnia"
                detail="To zostaje. Problemem nie jest moduł, tylko brak jasnych podpowiedzi, co wpisać. Ten ekran ma Cię prowadzić do 5 konkretnych ruchów."
              />
              <PlanningGuide />
              <IntentionTracker
                session={session}
                todayWin={todayWin}
                stability={stability}
                operationalState={operationalState}
              />
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />
            </section>
          )}

          {view === 'body' && (
            <section className="space-y-5">
              <SectionHeader
                title="Body"
                detail="Kroki, sen, kalorie, trening i eksport danych. To jest twarda warstwa, nie miejsce na rozmowę z Oracle."
              />
              <OuraWidget session={session} />
              <StravaWidget session={session} />

              <div className="rounded-2xl border border-white/5 bg-neutral-950/70 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35">Weekly calories</p>
                    <p className="text-xl font-black italic">{weeklyCalories} <span className="text-xs text-white/25">/ {weeklyBudget}</span></p>
                  </div>
                  <button onClick={syncYazio} disabled={isSyncing} className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-white/45 transition-colors hover:text-white">
                    <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                  </button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-orange-500 transition-all duration-1000"
                    style={{ width: `${Math.min((weeklyCalories / weeklyBudget) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  {[
                    { id: 'charts', label: 'Analytics', icon: BarChart2 },
                    { id: 'graph', label: 'Graph', icon: Brain }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedDataTab(tab.id)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-[9px] font-black uppercase tracking-widest transition-all ${
                        selectedDataTab === tab.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-white/5 bg-neutral-950 text-white/35'
                      }`}
                    >
                      <tab.icon size={13} />
                      {tab.label}
                    </button>
                  ))}
                </div>
                {selectedDataTab === 'charts' ? (
                  <Stats session={session} />
                ) : (
                  <GraphMind session={session} />
                )}
              </div>
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

          {view === 'photos' && <Photos session={session} />}
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
