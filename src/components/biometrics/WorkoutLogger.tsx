import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { getTodayWarsaw } from '../../lib/date';
import { ChevronLeft, Save, Dumbbell, Zap, Clock, Play, Square, Plus, TimerReset, X, Minus, Flame } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';
import {
  newExercise,
  newActivity,
  useStopwatch,
  useCountdown,
  type WorkoutExercise,
  type WorkoutActivity,
} from './workout/workoutUtils';
import ExerciseCard from './workout/ExerciseCard';
import ActivityCard from './workout/ActivityCard';
import VolumeBar from './workout/VolumeBar';

export default function WorkoutLogger({ session, onBack }: { session: any; onBack: () => void }) {
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises]     = useState<WorkoutExercise[]>([newExercise()]);
  const [activities, setActivities]   = useState<WorkoutActivity[]>([]);
  const [notes, setNotes]             = useState('');
  const [sessionRpe, setSessionRpe]   = useState<number | null>(null);
  const [saving, setSaving]           = useState(false);
  const [timerStart, setTimerStart]   = useState<number | null>(null);
  
  // Custom manual time overrides
  const [manualTime, setManualTime] = useState(false);
  const todayStr = getTodayWarsaw();
  const [workoutDate, setWorkoutDate] = useState(todayStr);
  const [startTimeManual, setStartTimeManual] = useState('18:00');
  const [endTimeManual, setEndTimeManual] = useState('19:00');

  const elapsed = useStopwatch(timerStart);
  const userId  = session?.user?.id;
  const haptics = useHaptics();

  // Rest timer — auto-starts when a set is checked off as done in ExerciseCard
  const [restDuration, setRestDuration] = useState(90);
  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const restRemaining = useCountdown(restEndTime);

  const playRestGong = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 1.2);
    } catch { /* AudioContext unavailable/blocked */ }
  }, []);

  useEffect(() => {
    if (restEndTime && restRemaining <= 0) {
      playRestGong();
      haptics.success();
      setRestEndTime(null);
    }
  }, [restRemaining, restEndTime, playRestGong, haptics]);

  const startRest = useCallback(() => {
    setRestEndTime(Date.now() + restDuration * 1000);
  }, [restDuration]);

  const adjustRest = (deltaSec: number) => {
    haptics.light();
    setRestEndTime(prev => prev ? Math.max(Date.now(), prev + deltaSec * 1000) : null);
  };

  const hasUnsavedData = Boolean(
    workoutName.trim() || notes.trim() || sessionRpe != null || timerStart != null ||
    exercises.some(e => e.name.trim()) || activities.some(a => a.name.trim())
  );

  const handleBack = () => {
    if (hasUnsavedData && !confirm('Masz niezapisane dane treningu — wyjść bez zapisywania?')) return;
    onBack();
  };

  const addExercise    = () => { haptics.light(); setExercises(p => [...p, newExercise()]); };
  const removeExercise = (id: number) => { if (exercises.length > 1) { haptics.light(); setExercises(p => p.filter(e => e.id !== id)); } };
  const updateExercise = (u: WorkoutExercise) => setExercises(p => p.map(e => e.id === u.id ? u : e));

  const addActivity    = () => { haptics.light(); setActivities(p => [...p, newActivity()]); };
  const removeActivity = (id: number) => { haptics.light(); setActivities(p => p.filter(a => a.id !== id)); };
  const updateActivity = (u: WorkoutActivity) => setActivities(p => p.map(a => a.id === u.id ? u : a));

  // Sauna/lodowata kąpiel/zimny prysznic get serie × minuty (+ opcjonalnie stopnie) via the
  // 'wellness' exercise tag — same Min/°C set UI as ExerciseCard, no need to rebuild it here.
  const addWellnessQuick = (name: string) => {
    haptics.light();
    setExercises(p => [...p, { ...newExercise(), name, tags: ['wellness'] }]);
  };

  async function save() {
    const validEx = exercises.filter(e => e.name.trim());
    const validAc = activities.filter(a => a.name.trim());
    if (!validEx.length && !validAc.length) { alert('Dodaj przynajmniej jedno ćwiczenie lub aktywność'); return; }

    setSaving(true);
    try {
      const exLogs = validEx.flatMap(ex =>
        ex.sets.map((s, i) => ({
          exercise_name: ex.name.trim(),
          set_number: i + 1,
          weight: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps) || 0,
          rir: s.rir !== '' ? parseFloat(s.rir) : null,
          rpe: null,
          is_pws_or_msp: s.msp === true,
          muscle_tags: ex.tags ?? [],
        }))
      );
      const acLogs = validAc.map((a, i) => ({
        exercise_name: a.note.trim() ? `${a.name.trim()} — ${a.note.trim()}` : a.name.trim(),
        set_number: i + 1,
        weight: 0,
        reps: parseInt(a.min) || 0,
        rpe: null,
        rir: null,
        muscle_tags: [],
      }));

      let finalStart: string | null = null;
      let finalEnd: string | null = null;

      if (manualTime) {
        finalStart = new Date(`${workoutDate}T${startTimeManual}:00`).toISOString();
        finalEnd = new Date(`${workoutDate}T${endTimeManual}:00`).toISOString();
      } else if (timerStart) {
        finalStart = new Date(timerStart).toISOString();
        finalEnd = new Date().toISOString();
      }

      const mspPassed = exLogs.some(l => l.is_pws_or_msp);

      const { error } = await supabase.rpc('save_workout_atomic', {
        p_user_id:     userId,
        p_day_key:     workoutName.trim() || (validEx.every(e => (e.tags ?? []).includes('wellness')) && validEx.length > 0 ? 'Sauna' : 'Trening'),
        p_start_time:  (finalStart as string),
        p_end_time:    (finalEnd as string),
        p_notes:       notes,
        p_msp_passed:  mspPassed,
        p_logs:        [...exLogs, ...acLogs],
        p_session_rpe: sessionRpe ?? undefined,
      });
      if (error) throw error;
      haptics.success();
      onBack();
    } catch (err) {
      haptics.error();
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 bg-background flex flex-col min-h-screen pb-32 transition-colors duration-300">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border-custom p-4 flex items-center gap-3">
        <button onClick={handleBack} className="p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-text-primary flex-1 font-display">Zaloguj Trening</h1>
        {timerStart ? (
          <button onClick={() => setTimerStart(null)} className="flex items-center gap-1.5 text-primary hover:text-primary-hover transition-colors cursor-pointer">
            <span className="text-[11px] font-black tabular-nums">{elapsed}</span>
            <Square size={11} className="fill-current" />
          </button>
        ) : (
          <button onClick={() => setTimerStart(Date.now())} className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <Play size={13} className="fill-current" />
            <span className="text-[10px] font-black uppercase tracking-widest">Start</span>
          </button>
        )}
      </header>

      {restEndTime && (
        <div className="sticky top-[60px] z-20 mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.08] backdrop-blur-md px-4 py-2.5 shadow-md animate-fadeIn">
          <button onClick={() => adjustRest(-15)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/25 text-primary active:scale-90 transition-all cursor-pointer">
            <Minus size={13} />
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <TimerReset size={14} className="text-primary shrink-0" />
            <span className="font-display text-xl font-black tabular-nums text-primary leading-none">
              {Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">odpoczynek</span>
          </div>
          <button onClick={() => adjustRest(15)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/25 text-primary active:scale-90 transition-all cursor-pointer">
            <Plus size={13} />
          </button>
          <button onClick={() => { haptics.light(); setRestEndTime(null); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-text-primary active:scale-90 transition-all cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      <main className="flex-1 p-5 space-y-8 max-w-md mx-auto w-full">
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Nazwa (opcjonalnie)</label>
          <input type="text" value={workoutName} onChange={e => setWorkoutName(e.target.value)}
            placeholder="np. Push, Nogi, Plecy/Bicep..."
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm font-bold text-text-primary outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all placeholder:text-text-muted/40" />
        </div>

        {/* Manual Time Picker Row */}
        <div className="rounded-[24px] border border-border-custom bg-surface p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-text-muted" />
              <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary">Wpisz godziny ręcznie</span>
            </div>
            <input
              type="checkbox"
              checked={manualTime}
              onChange={(event) => {
                setManualTime(event.target.checked);
                if (event.target.checked && timerStart) {
                  setTimerStart(null);
                }
              }}
              className="accent-primary h-4 w-4 rounded border-border-custom bg-surface-solid cursor-pointer"
            />
          </div>

          {manualTime && (
            <div className="grid grid-cols-3 gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Data</label>
                <input
                  type="date"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Start</label>
                <input
                  type="time"
                  value={startTimeManual}
                  onChange={(e) => setStartTimeManual(e.target.value)}
                  className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest text-text-muted">Koniec</label>
                <input
                  type="time"
                  value={endTimeManual}
                  onChange={(e) => setEndTimeManual(e.target.value)}
                  className="w-full bg-surface-solid border border-border-custom rounded-xl px-2 py-2 text-xs font-bold text-text-primary outline-none focus:border-primary/50 text-center cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Dumbbell size={12} className="text-text-muted" />
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Ćwiczenia</span>
            </div>
            <div className="flex items-center gap-1">
              <TimerReset size={11} className="text-text-muted/60" />
              {[60, 90, 120, 150].map(s => (
                <button
                  key={s}
                  onClick={() => { haptics.light(); setRestDuration(s); }}
                  className={`rounded-full px-2 py-1 text-[9px] font-black transition-all cursor-pointer ${
                    restDuration === s ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {s}s
                </button>
              ))}
            </div>
          </div>
          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onChange={updateExercise} onRemove={() => removeExercise(ex.id)} userId={userId} onSetDone={startRest} />
          ))}
          <button onClick={addExercise}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-custom bg-surface hover:bg-surface-solid hover:border-primary/45 p-3.5 text-[10px] font-black uppercase tracking-widest text-text-secondary transition-all cursor-pointer">
            <Plus size={13} /> Dodaj ćwiczenie
          </button>
          <VolumeBar exercises={exercises} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-text-muted" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Inne aktywności</span>
          </div>

          {/* Sauna/lodowata kąpiel get serie×min(+°C) — added as a wellness exercise above, not a plain activity */}
          <div className="flex gap-2">
            <button
              onClick={() => addWellnessQuick('Sauna')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-orange-500/25 bg-orange-500/[0.06] py-2 text-[10px] font-black uppercase tracking-wider text-orange-500 hover:bg-orange-500/10 active:scale-95 transition-all cursor-pointer"
            >
              <Flame size={12} /> + Sauna
            </button>
            <button
              onClick={() => addWellnessQuick('Lodowata kąpiel')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] py-2 text-[10px] font-black uppercase tracking-wider text-sky-500 hover:bg-sky-500/10 active:scale-95 transition-all cursor-pointer"
            >
              + Lodowata
            </button>
          </div>

          {activities.map(a => (
            <ActivityCard key={a.id} activity={a} onChange={updateActivity} onRemove={() => removeActivity(a.id)} />
          ))}
          <button onClick={addActivity}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-custom bg-surface hover:bg-surface-solid hover:border-orange-500/50 hover:text-orange-400 p-3.5 text-[10px] font-black uppercase tracking-widest text-text-secondary transition-all cursor-pointer">
            <Plus size={13} /> Dodaj aktywność (rower, spacer...)
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Notatki</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Jak poszło?..."
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm text-text-primary min-h-[100px] outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all resize-none placeholder:text-text-muted/40" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">RPE sesji</label>
            {sessionRpe && (
              <button onClick={() => setSessionRpe(null)} className="text-[9px] text-text-muted hover:text-text-secondary transition-colors cursor-pointer">wyczyść</button>
            )}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const color = n <= 4 ? 'border-sky-500/30 dark:border-sky-500/40 text-sky-650 dark:text-sky-400 bg-sky-500/8 dark:bg-sky-500/15 hover:bg-sky-500/20'
                          : n <= 6 ? 'border-yellow-500/35 dark:border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/8 dark:bg-yellow-500/15 hover:bg-yellow-500/20'
                          : n <= 8 ? 'border-orange-500/35 dark:border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/8 dark:bg-orange-500/15 hover:bg-orange-500/20'
                          : 'border-dayB/35 dark:border-dayB/40 text-dayB bg-dayB/8 dark:bg-dayB/15 hover:bg-dayB/20';
              const active = sessionRpe === n ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100 scale-105 shadow-sm' : 'opacity-80 hover:opacity-100';
              return (
                <button key={n} onClick={() => setSessionRpe(sessionRpe === n ? null : n)}
                  className={`rounded-lg border py-2 text-[11px] font-black transition-all cursor-pointer ${color} ${active}`}>
                  {n}
                </button>
              );
            })}
          </div>
          <p className="text-[9px] text-text-muted">
            {sessionRpe ? (sessionRpe <= 4 ? 'Łatwa — dużo rezerwy' : sessionRpe <= 6 ? 'Umiarkowana' : sessionRpe <= 8 ? 'Ciężka — mało rezerwy' : 'Maksymalna — do oporu') : 'Jak ciężka była cała sesja?'}
          </p>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border-custom space-y-3 z-30">
        {(() => {
          const totalVol = exercises.reduce((sum, ex) => {
            if ((ex.tags || []).includes('wellness')) return sum;
            const exVol = (ex.sets || []).reduce((sSum, s) => sSum + (parseFloat(s.kg) || 0) * (parseInt(s.reps) || 0), 0);
            return sum + exVol;
          }, 0);
          if (totalVol === 0) return null;
          return (
            <div className="flex justify-between items-center px-1 max-w-md mx-auto w-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Suma Objętości:</span>
              <span className="text-[12px] font-black text-primary tracking-wide font-display">{totalVol.toLocaleString()} kg</span>
            </div>
          );
        })()}
        <div className="max-w-md mx-auto w-full">
          <button onClick={save} disabled={saving}
            className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform hover:bg-primary-hover cursor-pointer">
            <Save size={15} />
            {saving ? 'Zapisywanie...' : 'Zapisz'}
          </button>
        </div>
      </footer>
    </div>
  );
}
