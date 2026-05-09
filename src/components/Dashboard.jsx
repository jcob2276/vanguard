// V2.2.1
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Fingerprint, LogOut, Play, Dumbbell, BarChart2, Camera, ChevronDown, ChevronUp, Trophy, History, Compass, Shield, RotateCw, MapPin, BookOpen, Activity, Calendar, Shield as ShieldIcon, Target, CheckSquare, Square, ChevronRight, Clock, Sparkles } from 'lucide-react';
import WorkoutExecution from './WorkoutExecution';
import ProgressionTable from './ProgressionTable';
import Stats from './Stats';
import Photos from './Photos';
import Direction from './Direction';
import MentorChat from './MentorChat';
import Fundament from './Fundament';
import OuraWidget from './OuraWidget';
import LocationTracker from './LocationTracker';
import AIInsight from './AIInsight';
import PowerList from './PowerList';
import { useDashboardData } from '../hooks/useDashboardData';
import { useStore } from '../store/useStore';
import { format, parseISO } from 'date-fns';
import { detectState, OPERATING_STATES, calculateIdentityScore, discoverPatterns } from '../lib/stateEngine';

const TrendArrow = ({ current, previous, better = 'up' }) => {
  if (previous === undefined || previous === null || current === undefined || current === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="ml-1 text-neutral-500">→</span>;
  const isImproving = better === 'up' ? diff > 0 : diff < 0;
  return <span className={`ml-1 font-black ${isImproving ? 'text-dayC' : 'text-dayB'}`}>{diff > 0 ? '↑' : '↓'}</span>;
};

export default function Dashboard({ session }) {
  console.log('--- DASHBOARD V2.2.1 ACTIVE ---');
  const [view, setView] = useState('workout');
  const [selectedDay, setSelectedDay] = useState(null);
  const [showProgression, setShowProgression] = useState(false);
  const { mspFeedbackMap, lastDayASession, weeklyCalories, todayWin, proteinToday, hasWorkoutToday, ouraToday, streak, history, syncYazio, refresh, loading } = useDashboardData();
  const { isSyncing } = useStore();
  const weeklyBudget = 12600; // 1800 * 7

  const currentStateKey = detectState({
    todayWin,
    oura: ouraToday?.[0],
    workoutToday: hasWorkoutToday,
    streak,
    protein: proteinToday
  });
  const state = OPERATING_STATES[currentStateKey];

  const identityScore = calculateIdentityScore({
    todayWin,
    hasWorkoutToday,
    protein: proteinToday,
    ouraToday: ouraToday?.[0],
    streak
  });

  const patterns = discoverPatterns(history, [], ouraToday);

  if (view === 'fundament') return <Fundament onBack={() => setView('workout')} />;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Ładowanie danych...</p>
      </div>
    );
  }

  if (selectedDay) {
    return <WorkoutExecution dayKey={selectedDay} session={session} onBack={() => setSelectedDay(null)} />;
  }

  const getDaySuggestion = (dayKey) => {
    const lastA = lastDayASession;
    if (dayKey === 'A' && lastA?.benchLogs) {
      const avgMsp = lastA.benchLogs.reduce((acc, l) => acc + (l.rpe || 0), 0) / lastA.benchLogs.length;
      if (avgMsp < 0.5) return '+2,5 kg (Brak MSP)';
      if (avgMsp > 1.5) return 'Zostań / Deload (Za ciężko)';
      return '+1-2 kg (Idealne MSP)';
    }

    const lastMsp = mspFeedbackMap[dayKey];
    switch(dayKey) {
      case 'A': return lastMsp === true ? '+2,5 kg' : lastMsp === false ? 'Szlifuj MSP' : 'Ciężka Góra';
      case 'B': return '6 serii – tył barku';
      case 'C': return 'Pamiętaj o podwinięciu miednicy';
      case 'D': return 'LEKKO – zostaw 1-2 powt.';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto relative bg-background border-x border-neutral-900 shadow-2xl">
      <LocationTracker session={session} />
      
      {/* Header */}
      <header className="p-4 border-b border-neutral-800 flex justify-between items-center sticky top-0 bg-background/80 backdrop-blur-md z-20">
        <div>
          <h1 className="font-black text-xl text-white uppercase tracking-tighter italic">VANGUARD PROTOCOL</h1>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest italic">OPERATOR: {session.user.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setView('fundament')} className="p-2 text-primary hover:text-white transition-colors">
            <Fingerprint size={20} />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 text-neutral-500 hover:text-white transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {view === 'workout' && (
          <div className="p-6 space-y-8">
            <OuraWidget session={session} />

            {/* Operating State Widget */}
            <section className="animate-in fade-in zoom-in duration-700">
              <div className={`border-2 ${state.border} ${state.bg} rounded-lg p-6 relative overflow-hidden shadow-2xl`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Operating State</p>
                    <h2 className={`text-3xl font-black ${state.color} italic tracking-tighter`}>{state.label}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Identity Score</p>
                    <p className={`text-3xl font-black italic tracking-tighter ${identityScore > 80 ? 'text-dayC' : identityScore > 50 ? 'text-primary' : 'text-dayB'}`}>
                      {identityScore}%
                    </p>
                  </div>
                </div>
                <p className="text-[11px] font-bold text-white uppercase italic leading-tight">
                  {state.description}
                </p>
                <div className="mt-4 pt-4 border-t border-white/5 flex gap-4">
                   <div className="flex-1">
                      <p className="text-[8px] font-black text-neutral-600 uppercase">Power List</p>
                      <p className={`text-[10px] font-black uppercase ${todayWin?.result === 'Z' ? 'text-dayC' : 'text-neutral-500'}`}>
                        {todayWin?.result === 'Z' ? 'Executed' : 'Pending'}
                      </p>
                   </div>
                   <div className="flex-1">
                      <p className="text-[8px] font-black text-neutral-600 uppercase">Training</p>
                      <p className={`text-[10px] font-black uppercase ${hasWorkoutToday ? 'text-primary' : 'text-neutral-500'}`}>
                        {hasWorkoutToday ? 'Active' : 'Rest'}
                      </p>
                   </div>
                   <div className="flex-1">
                      <p className="text-[8px] font-black text-neutral-600 uppercase">Integrity</p>
                      <p className="text-[10px] font-black text-white uppercase">{identityScore > 90 ? 'High' : 'At Risk'}</p>
                   </div>
                </div>
              </div>
            </section>

            {/* POWER LIST - MIGRATED FROM DIRECTION */}
            <PowerList session={session} todayWin={todayWin} onUpdate={() => refresh()} />

            {/* ACTION CENTER: CALORIES & TODAY'S WORKOUT */}
            <div className="grid gap-6">
              {/* Today's Workout Focus */}
              <section className="space-y-3">
                <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                  <Dumbbell size={12} className="text-primary" /> Today's Protocol
                </h3>
                {(() => {
                  const today = new Date().getDay();
                  const map = { 1: 'A', 2: 'B', 4: 'C', 5: 'D' }; // Mon, Tue, Thu, Fri
                  const dayKey = map[today] || 'A';
                  const dayData = [
                    { key: 'A', title: 'Dzień A', sub: 'Góra Ciężka / Bench', color: 'dayA' },
                    { key: 'B', title: 'Dzień B', sub: 'Plecy / Tył Barku', color: 'dayB' },
                    { key: 'C', title: 'Dzień C', sub: 'Nogi / ATP / Core', color: 'dayC' },
                    { key: 'D', title: 'Dzień D', sub: 'Lekki Bench / Ramiona', color: 'dayD' },
                  ].find(d => d.key === dayKey);

                  return (
                    <button 
                      onClick={() => setSelectedDay(dayData.key)}
                      className={`w-full bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex items-center justify-between group hover:bg-neutral-800/50 transition-all border-l-4 border-l-${dayData.color} ${!hasWorkoutToday ? 'ring-1 ring-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'opacity-60'}`}
                    >
                      <div>
                        <h3 className="font-black text-white uppercase italic text-xl">{dayData.title}</h3>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase mb-1">{dayData.sub}</p>
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest">
                          {getDaySuggestion(dayData.key)}
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                        <Play size={18} fill="currentColor" />
                      </div>
                    </button>
                  );
                })()}
              </section>

              {/* Weekly Calorie Budget */}
              <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Calorie Budget</h3>
                    <p className="text-xl font-black text-white uppercase italic">
                      {weeklyCalories.toLocaleString()} <span className="text-xs text-neutral-500">/ {weeklyBudget.toLocaleString()} kcal</span>
                    </p>
                  </div>
                  <button onClick={syncYazio} disabled={isSyncing} className={`p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-primary ${isSyncing ? 'animate-spin' : ''}`}>
                    <RotateCw size={14} />
                  </button>
                </div>
                
                <div className="w-full h-2 bg-neutral-950 rounded-full border border-neutral-800 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${weeklyCalories > weeklyBudget ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                    style={{ width: `${Math.min((weeklyCalories / weeklyBudget) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-black uppercase text-neutral-600">
                  <span>{(weeklyBudget - weeklyCalories).toLocaleString()} kcal Left</span>
                  <span>Target: 1800/Day</span>
                </div>
              </section>
            </div>

            {/* AI Insight moved to bottom for evening evaluation */}
            <div className="pt-8 border-t border-white/5">
              <AIInsight session={session} />
            </div>

            {/* Personal Operating Manual (Patterns) */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                <BookOpen size={12} className="text-primary" /> Patterns & Anomalies
              </h3>
              <div className="space-y-3">
                {patterns.map(p => (
                  <div key={p.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg flex gap-4 items-center">
                    <span className="text-2xl">{p.icon}</span>
                    <p className="text-[11px] font-bold text-white uppercase italic leading-tight tracking-tight">
                      {p.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Ostatni Trening A Widget */}
            {lastDayASession && (
              <section className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <History size={12} /> Last Matrix Entry ({format(parseISO(lastDayASession.created_at), 'dd.MM')})
                  </h3>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${lastDayASession.msp_passed ? 'bg-dayC text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                    MSP: {lastDayASession.msp_passed ? 'PASSED' : 'FAILED'}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {lastDayASession.benchLogs.map((l, i) => (
                    <div key={i} className="bg-neutral-950 px-2 py-1 rounded border border-neutral-900 text-[10px] font-bold text-white">
                      {l.weight}kg x {l.reps}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Progresja */}
            <section className="space-y-3">
              <button 
                onClick={() => setShowProgression(!showProgression)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-between p-4 hover:bg-neutral-800/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Trophy className="text-primary" size={20} />
                  <div className="text-left">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Planned Matrix Progression</h3>
                    <p className="text-[8px] text-neutral-500 font-bold uppercase">Target: 100 kg Bench Press</p>
                  </div>
                </div>
                {showProgression ? <ChevronUp size={16} className="text-neutral-500" /> : <ChevronDown size={16} className="text-neutral-500" />}
              </button>
              
              {showProgression && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <ProgressionTable session={session} />
                </div>
              )}
            </section>

            {/* Zasady 2.1 */}
            <section className="card bg-neutral-900/20 border-neutral-800 p-5 space-y-4">
              <h2 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase flex items-center gap-2">
                <Shield size={12} className="text-primary" /> Zasady Grande Finale 2.1
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[8px] text-neutral-500 font-bold uppercase">Białko</p>
                  <p className="text-[12px] font-black text-white uppercase italic">2.0-2.2g / KG</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] text-neutral-500 font-bold uppercase">Deficyt</p>
                  <p className="text-[12px] font-black text-white uppercase italic">300-500 KCAL</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] text-neutral-500 font-bold uppercase">Kroki</p>
                  <p className="text-[12px] font-black text-white uppercase italic">8-10K Dziennie</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] text-neutral-500 font-bold uppercase">Sen</p>
                  <p className="text-[12px] font-black text-white uppercase italic">Min. 7.5 H</p>
                </div>
              </div>
              <div className="pt-2 border-t border-neutral-800/50">
                <p className="text-[9px] font-black text-primary uppercase italic text-center italic tracking-widest">
                  16 tygodni bez wymówek. Rób swoje.
                </p>
              </div>
            </section>
          </div>
        )}
        {view === 'stats' && <Stats session={session} />}
        {view === 'photos' && <Photos session={session} />}
        {view === 'direction' && <Direction session={session} />}
        {view === 'mentor' && <MentorChat session={session} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md bg-background/90 backdrop-blur-xl border-t border-neutral-800 p-3 flex justify-around items-center z-30">
        <button onClick={() => setView('workout')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'workout' ? 'text-primary' : 'text-neutral-500'}`}>
          <Dumbbell size={24} /><span className="text-[8px] font-bold uppercase">Trening</span>
        </button>
        <button onClick={() => setView('direction')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'direction' ? 'text-primary' : 'text-neutral-500'}`}>
          <Compass size={24} /><span className="text-[8px] font-bold uppercase">Kierunek</span>
        </button>
        <button onClick={() => setView('mentor')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'mentor' ? 'text-primary' : 'text-neutral-500'}`}>
          <Sparkles size={24} /><span className="text-[8px] font-bold uppercase">Mentor</span>
        </button>
        <button onClick={() => setView('stats')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'stats' ? 'text-primary' : 'text-neutral-500'}`}>
          <BarChart2 size={24} /><span className="text-[8px] font-bold uppercase">Statystyki</span>
        </button>
        <button onClick={() => setView('photos')} className={`flex flex-col items-center gap-1 transition-colors ${view === 'photos' ? 'text-primary' : 'text-neutral-500'}`}>
          <Camera size={24} /><span className="text-[8px] font-bold uppercase">Zdjęcia</span>
        </button>
      </nav>
    </div>
  );
}
