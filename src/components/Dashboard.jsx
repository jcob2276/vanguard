import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Fingerprint, LogOut, Play, Dumbbell, BarChart2, 
  Camera, Compass, Activity, Zap, Target, 
  Clock, Shield, Brain, Sparkles, Layout, RotateCw, Database, Calendar
} from 'lucide-react';
import WorkoutExecution from './WorkoutExecution';
import ProgressionTable from './ProgressionTable';
import Stats from './Stats';
import Photos from './Photos';
import Direction from './Direction';
import MentorChat from './MentorChat';
import Fundament from './Fundament';
import DataHub from './DataHub';
import OuraWidget from './OuraWidget';
import AIInsight from './AIInsight';
import StayFreeDashboard from './StayFreeDashboard';
import PowerList from './PowerList';
import IntentionTracker from './IntentionTracker';
import ThoughtStream from './ThoughtStream';
import { syncActivityWatch } from '../lib/activityWatch';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStore } from '../store/useStore';
import { format, parseISO } from 'date-fns';

export default function Dashboard({ session }) {
  const [view, setView] = useState('workout');
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDataTab, setSelectedDataTab] = useState('charts');
  const { 
    lastDayASession, weeklyCalories, todayWin, 
    syncYazio, loading, nextSuggestedDay, refresh 
  } = useDashboardData();
  const { isSyncing, setSyncing } = useStore();
  const weeklyBudget = 12600;

  useEffect(() => {
    // 1. Google OAuth Handle
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && session) {
      handleGoogleCallback(code);
    }
  }, [session]);

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
        window.history.replaceState({}, document.title, "/");
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
        body: JSON.stringify({ userId: session.user.id })
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
      ].join(' '),
    };
    const qs = new URLSearchParams(options);
    window.location.href = `${root}?${qs.toString()}`;
  }

  if (view === 'fundament') return <Fundament onBack={() => setView('workout')} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  if (selectedDay) {
    return <WorkoutExecution dayKey={selectedDay} session={session} onBack={() => setSelectedDay(null)} />;
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col relative pb-24 border-x border-white/5">
        
        {/* TOP STATUS BAR (PREMIUM HUD) */}
        <header className="sticky top-0 z-30 px-6 py-4 bg-black/60 backdrop-blur-xl border-b border-white/5 flex justify-between items-center">
          <div>
            <h1 className="text-xs font-black tracking-[0.3em] text-primary uppercase">Digital Twin 2.0</h1>
            <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">{format(new Date(), 'EEEE, d MMMM')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={startGoogleAuth} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5">
              <Calendar size={16} className="text-white/40" />
            </button>
            <button onClick={() => setView('fundament')} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5">
              <Fingerprint size={16} className="text-primary" />
            </button>
            <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5">
              <LogOut size={16} className="text-white/40" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-8 animate-in fade-in duration-700">
          
          {/* SYSTEM STATE HUB */}
          {view === 'workout' && (
            <>
              {/* PLANNING ALERT */}
              {(() => {
                const hour = new Date().getHours();
                if (hour >= 22) {
                  return (
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6 animate-pulse">
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Shadow Protocol Alert</p>
                      <p className="text-xs font-bold text-white italic">Jakub, nie zaplanowałeś jutra. Twój Cień będzie błądził w ciemnościach.</p>
                    </div>
                  );
                }
                return null;
              })()}

              <section className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-neutral-900/40 border border-white/10 rounded-3xl p-6 backdrop-blur-sm overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Operational State</p>
                      <h2 className="text-2xl font-black italic tracking-tighter uppercase">
                        {todayWin?.result === 'Z' ? 'System Locked' : 'Analysis Pending'}
                      </h2>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                      <Brain size={20} className="text-primary" />
                    </div>
                  </div>
                  
                  {/* Quick Vitals */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-[8px] font-bold text-white/30 uppercase">Focus</p>
                      <p className="text-xs font-black text-white italic">High</p>
                    </div>
                    <div className="space-y-1 text-center border-x border-white/5">
                      <p className="text-[8px] font-bold text-white/30 uppercase">Recovery</p>
                      <p className="text-xs font-black text-white italic">Stable</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[8px] font-bold text-white/30 uppercase">Stability</p>
                      <p className="text-xs font-black text-white italic">94%</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* INTENTION TRACKER (NEW) */}
              <IntentionTracker session={session} />

              {/* CORE ACTIONS: POWER LIST */}
              <PowerList session={session} todayWin={todayWin} onUpdate={refresh} />

              {/* AI INSIGHT LAYER */}
              <AIInsight session={session} />



              {/* PROTOCOL MODULES GRID */}
              <div className="grid grid-cols-2 gap-4">
                {/* Physical Protocol (Trening) */}
                <button 
                  onClick={() => setSelectedDay(nextSuggestedDay)}
                  className="col-span-2 bg-gradient-to-br from-neutral-900 to-black border border-white/10 rounded-2xl p-5 flex items-center justify-between group hover:border-primary/40 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <Dumbbell size={24} />
                    </div>
                    <div className="text-left">
                      <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Physical Protocol</p>
                      <p className="text-sm font-black text-white uppercase italic">Dzień {nextSuggestedDay}</p>
                    </div>
                  </div>
                  <Play size={16} className="text-primary opacity-0 group-hover:opacity-100 transition-all" fill="currentColor" />
                </button>

                {/* Nutrition Module */}
                <div className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <Zap size={16} className="text-orange-500" />
                    <button onClick={syncYazio} disabled={isSyncing} className={`text-white/20 hover:text-white transition-all ${isSyncing ? 'animate-spin' : ''}`}>
                      <RotateCw size={14} />
                    </button>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-white/30 uppercase mb-1">Calories</p>
                    <p className="text-sm font-black text-white italic">{weeklyCalories} <span className="text-[9px] text-white/20">/ 12.6k</span></p>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)] transition-all duration-1000"
                      style={{ width: `${Math.min((weeklyCalories / weeklyBudget) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Biological Module (Oura/StayFree) */}
                <button 
                  onClick={() => setView('stayfree')}
                  className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/20 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <Activity size={16} className="text-primary" />
                    <Compass size={14} className="text-white/20" />
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-white/30 uppercase mb-1">Digital Signal</p>
                    <p className="text-sm font-black text-white italic">Sync Ready</p>
                  </div>
                  <p className="text-[7px] font-black text-primary uppercase tracking-widest">Mirror Mode Active</p>
                </button>
              </div>

              {/* Biological History (Oura) */}
              <OuraWidget session={session} />
            </>
          )}

          {/* OTHER VIEWS */}
          {view === 'stats' && (
            <div className="flex flex-col h-full">
              <div className="flex gap-4 px-6 mb-4">
                <button 
                  onClick={() => setSelectedDataTab('charts')}
                  className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedDataTab === 'charts' ? 'bg-primary/10 border-primary text-primary' : 'bg-neutral-900 border-white/5 text-white/30'}`}
                >
                  Analytics
                </button>
                <button 
                  onClick={() => setSelectedDataTab('import')}
                  className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${selectedDataTab === 'import' ? 'bg-primary/10 border-primary text-primary' : 'bg-neutral-900 border-white/5 text-white/30'}`}
                >
                  Import
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedDataTab === 'charts' ? <Stats session={session} /> : <DataHub session={session} />}
              </div>
            </div>
          )}
          {view === 'photos' && <Photos session={session} />}
          {view === 'direction' && <Direction session={session} />}
          {view === 'mentor' && <MentorChat session={session} />}
          {view === 'stayfree' && <StayFreeDashboard session={session} />}
        </main>

        {/* PREMIUM BOTTOM NAV */}
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] bg-neutral-900/80 backdrop-blur-2xl border border-white/10 p-2 rounded-full flex justify-between items-center z-40 shadow-2xl">
          {[
            { id: 'workout', icon: Layout, label: 'Mirror' },
            { id: 'direction', icon: Compass, label: 'Path' },
            { id: 'stats', icon: BarChart2, label: 'Data' },
            { id: 'mentor', icon: Sparkles, label: 'Oracle' },
            { id: 'photos', icon: Camera, label: 'Visual' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-full transition-all ${view === item.id ? 'bg-white/5 text-primary scale-110' : 'text-white/40 hover:text-white'}`}
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
