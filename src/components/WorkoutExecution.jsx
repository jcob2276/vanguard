import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Timer, CheckCircle2, ChevronRight, Play, AlertTriangle, MessageSquare, Clock, Trophy, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { WORKOUT_PLAN } from '../data/workoutPlan';

export default function WorkoutExecution({ session, dayKey, onBack }) {
  const plan = WORKOUT_PLAN[dayKey];
  const [exercises, setExercises] = useState([]);
  const [activeExerciseIdx, setActiveExerciseIdx] = useState(0);
  const [restTimer, setRestTimer] = useState(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [mspFeedback, setMspFeedback] = useState(null);
  const [previousData, setPreviousData] = useState({});
  const [startTime, setStartTime] = useState(new Date());

  useEffect(() => {
    fetchPreviousData();
  }, []);

  async function fetchPreviousData() {
    try {
      const { data: lastSessions } = await supabase
        .from('workout_sessions')
        .select('*, exercise_logs(*)')
        .eq('user_id', session.user.id)
        .eq('workout_day', dayKey)
        .order('created_at', { ascending: false })
        .limit(1);

      const prevMap = {};
      if (lastSessions?.[0]?.exercise_logs) {
        lastSessions[0].exercise_logs.forEach(log => {
          if (!prevMap[log.exercise_name]) prevMap[log.exercise_name] = [];
          prevMap[log.exercise_name].push(log);
        });
      }
      setPreviousData(prevMap);

      // Check for local draft
      const draftKey = `workout_draft_${dayKey}`;
      const savedDraft = localStorage.getItem(draftKey);
      
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft && Array.isArray(draft.exercises)) {
            setExercises(draft.exercises);
            // Ensure index is within bounds
            const idx = draft.activeExerciseIdx || 0;
            setActiveExerciseIdx(idx < draft.exercises.length ? idx : 0);
            setSessionNotes(draft.sessionNotes || '');
            if (draft.startTime) setStartTime(new Date(draft.startTime));
            return; // Exit if draft loaded successfully
          }
        } catch (e) {
          console.error('Failed to parse workout draft', e);
          localStorage.removeItem(draftKey);
        }
      } 
      
      // Fallback to plan if no draft or draft failed
      if (plan?.exercises) {
        const initialExercises = plan.exercises.map(ex => ({
          ...ex,
          sets: Array.from({ length: ex.sets }, () => ({ weight: '', reps: '', rpe: '' }))
        }));
        setExercises(initialExercises);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }

  // Consolidated auto-save effect
  useEffect(() => {
    if (exercises.length > 0) {
      const draft = {
        exercises,
        activeExerciseIdx,
        sessionNotes,
        startTime: startTime.toISOString()
      };
      localStorage.setItem(`workout_draft_${dayKey}`, JSON.stringify(draft));
    }
  }, [exercises, activeExerciseIdx, sessionNotes, startTime, dayKey]);

  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => {
      const updated = [...prev];
      if (!updated[exIdx]) return prev;
      
      const exercise = { ...updated[exIdx] };
      const sets = [...exercise.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };
      exercise.sets = sets;
      updated[exIdx] = exercise;
      
      // Auto-timer
      if (field === 'reps' && value !== '' && sets[setIdx].weight !== '') {
        setRestTimer(90);
      }
      
      return updated;
    });
  }

  useEffect(() => {
    let interval;
    if (restTimer > 0) {
      interval = setInterval(() => setRestTimer(prev => prev - 1), 1000);
    } else if (restTimer === 0) {
      setRestTimer(null);
    }
    return () => clearInterval(interval);
  }, [restTimer]);

  async function finishWorkout() {
    setIsFinishing(true);
    try {
      const endTime = new Date();
      const logs = exercises.flatMap(ex => 
        ex.sets.filter(s => s.weight && s.reps).map((s, idx) => {
          let w = parseFloat(s.weight);
          let r = parseInt(s.reps);

          // SAFEGUARD: Check for swapped weight/reps
          const compoundLifts = ['Przysiad', 'Wyciskanie', 'RDL', 'OHP', 'Martwy'];
          const isCompound = compoundLifts.some(name => ex.name.includes(name));
          
          if (isCompound && w < 30 && r >= 30) {
            const confirmSwap = window.confirm(`⚠️ Podejrzany wpis w ${ex.name}: ${w}kg x ${r} powt.\n\nCzy na pewno nie zamieniłeś wagi z powtórzeniami?`);
            if (confirmSwap) { const temp = w; w = r; r = temp; }
          }

          return {
            exercise_name: ex.name,
            set_number: idx + 1,
            weight: w,
            reps: r,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
            rir: s.rpe ? parseFloat(s.rpe) : null,
            muscle_tags: []
          };
        })
      );

      const { error: rpcError } = await supabase.rpc('save_workout_atomic', {
        p_user_id: session.user.id,
        p_day_key: dayKey,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_notes: sessionNotes,
        p_msp_passed: exercises.some(ex => ex.name.toLowerCase().includes('wyciskanie płaskie') && ex.name.toLowerCase().includes('heavy') && ex.sets.some(s => s.rpe === '1')),
        p_logs: logs
      });

      if (rpcError) throw rpcError;
      localStorage.removeItem(`workout_draft_${dayKey}`);
      alert('Trening zapisany!');
      onBack();
    } catch (err) {
      alert(err.message);
    } finally { setIsFinishing(false); }
  }

  if (!exercises.length || !plan) return <div className="p-12 text-center text-neutral-500 font-black uppercase tracking-widest animate-pulse">Przygotowanie gryfu...</div>;

  const currentEx = exercises[activeExerciseIdx];
  const isLastExercise = activeExerciseIdx === exercises.length - 1;

  return (
    <div className="flex-1 bg-background flex flex-col min-h-screen pb-32">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-neutral-900 p-4 flex justify-between items-center">
        <button onClick={onBack} className="p-2 text-neutral-400"><ChevronLeft /></button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            <span className="text-[8px] font-black text-white uppercase tracking-[0.2em]">Ćwiczenie {activeExerciseIdx + 1} / {exercises.length}</span>
          </div>
          <span className="text-[10px] font-bold text-neutral-500 uppercase mt-0.5 truncate max-w-[150px]">{plan?.title}</span>
        </div>
        <div className="w-10" />
      </header>

      <div className="w-full h-1 bg-neutral-900">
        <div 
          className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
          style={{ width: `${((activeExerciseIdx + 1) / exercises.length) * 100}%` }}
        />
      </div>

      <main className="flex-1 p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300" key={activeExerciseIdx}>
        <section className="space-y-6">
          <div>
            <h2 className="text-3xl font-black uppercase italic text-white tracking-tighter leading-none">{currentEx?.name}</h2>
            <p className="text-xs text-neutral-500 font-bold uppercase mt-2">{currentEx?.notes}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1">Cel Planu</span>
              <span className="text-xl font-black text-white">{currentEx?.sets?.length || 0} x {currentEx?.reps}</span>
              <span className="text-[8px] text-primary font-bold uppercase mt-1">Tempo: {currentEx?.tempo}</span>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest mb-1">Ostatnio</span>
              <span className="text-xl font-black text-primary">
                {previousData[currentEx?.name]?.[0]?.weight || '--'} <span className="text-xs text-neutral-600">KG</span>
              </span>
              <span className="text-[8px] text-neutral-500 font-bold uppercase mt-1">Najlepszy wynik</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="grid grid-cols-4 gap-2 px-2 text-[8px] font-black text-neutral-600 uppercase tracking-widest">
            <span>Seria</span><span>KG</span><span>Reps</span><span>MSP (0-2)</span>
          </div>
          <div className="space-y-3">
            {currentEx?.sets?.map((set, setIdx) => {
              const prevSet = previousData[currentEx?.name]?.[setIdx];
              return (
                <div key={setIdx} className="grid grid-cols-4 gap-2 bg-neutral-900/30 p-2 rounded-2xl border border-neutral-900/50 focus-within:border-primary/50 transition-colors">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-neutral-500">{setIdx + 1}</span>
                    {prevSet && <span className="text-[7px] text-primary font-bold">({prevSet.reps}x)</span>}
                  </div>
                  <input 
                    type="number" step="0.5"
                    placeholder={prevSet?.weight || "0"} 
                    value={set.weight} 
                    onChange={(e) => updateSet(activeExerciseIdx, setIdx, 'weight', e.target.value)} 
                    className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm font-black text-white text-center outline-none focus:border-primary" 
                  />
                  <input 
                    type="number" 
                    placeholder={prevSet?.reps || "0"} 
                    value={set.reps} 
                    onChange={(e) => updateSet(activeExerciseIdx, setIdx, 'reps', e.target.value)} 
                    className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm font-black text-white text-center outline-none focus:border-primary" 
                  />
                  <input 
                    type="number"
                    placeholder="0" 
                    value={set.rpe} 
                    onChange={(e) => updateSet(activeExerciseIdx, setIdx, 'rpe', e.target.value)} 
                    className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm font-black text-white text-center outline-none focus:border-primary" 
                  />
                </div>
              );
            })}
          </div>
        </section>

        {isLastExercise && (
          <section className="space-y-3 pt-8 border-t border-neutral-900">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={12} /> Notatki końcowe</label>
            <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Jak poszło?..." className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-sm text-white min-h-[120px] outline-none focus:border-primary transition-colors" />
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-neutral-900 flex gap-3">
        {activeExerciseIdx > 0 && (
          <button onClick={() => setActiveExerciseIdx(prev => prev - 1)} className="flex-1 bg-neutral-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs border border-neutral-800">Wstecz</button>
        )}
        {!isLastExercise ? (
          <button onClick={() => setActiveExerciseIdx(prev => prev + 1)} className="flex-[2] bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20">Następne Ćwiczenie</button>
        ) : (
          <button onClick={finishWorkout} disabled={isFinishing} className="flex-[2] bg-green-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-green-900/20">{isFinishing ? 'Zapisywanie...' : 'Zakończ Trening'}</button>
        )}
      </footer>

      {restTimer !== null && (
        <div className="fixed bottom-28 right-4 bg-neutral-950 border-2 border-primary text-white px-6 py-3 rounded-full font-black shadow-2xl flex items-center gap-3">
          <Clock size={18} className="text-primary" /> {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, '0')}
        </div>
      )}
    </div>
  );
}
