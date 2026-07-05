import { useState, useEffect, useCallback, useRef } from 'react';
import { getTodayWarsaw } from '../../lib/date';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, Save, Dumbbell, Clock, Play, Square, Plus } from 'lucide-react';
import { useHaptics } from '../../hooks/useHaptics';
import { notify, confirmDialog } from '../../lib/notify';
import {
  newExercise,
  useStopwatch,
  type WorkoutExercise,
  type WorkoutActivity,
} from './workout/workoutUtils';
import {
  endWorkoutSession,
  hasResumableWorkoutDraftContent,
  isWorkoutSessionActive,
  loadWorkoutDraft,
  markWorkoutSessionActive,
  persistWorkoutDraft,
  saveWorkoutDraft,
  saveWorkoutSession,
  type WorkoutDraft,
  type WorkoutLoggerInitial,
} from '../../lib/workoutLogging';
import ExerciseCard from './workout/ExerciseCard';
import VolumeBar from './workout/VolumeBar';
import PlyoBlock from './workout/PlyoBlock';
import {
  advancePlyoProgram,
  clearPlyoCheckoff,
  initPlyoCheckoff,
  isPlyoSessionComplete,
  plyoPrescriptionToLogs,
  resolvePlyoSession,
  savePlyoCheckoff,
} from '../../lib/plyoMarathonProgram';

export default function WorkoutLogger({
  session,
  onBack,
  initial,
  onSaved,
}: {
  session: any;
  onBack: () => void;
  initial?: WorkoutLoggerInitial | null;
  onSaved?: () => void;
}) {
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises]     = useState<WorkoutExercise[]>([newExercise()]);
  const [activities, setActivities]   = useState<WorkoutActivity[]>([]);
  const [notes, setNotes]             = useState('');
  const [sessionRpe, setSessionRpe]   = useState<number | null>(null);
  const [saving, setSaving]           = useState(false);
  const [timerStart, setTimerStart]   = useState<number | null>(() => Date.now());
  
  // Custom manual time overrides
  const [manualTime, setManualTime] = useState(false);
  const todayStr = getTodayWarsaw();
  const [workoutDate, setWorkoutDate] = useState(todayStr);
  const [startTimeManual, setStartTimeManual] = useState('18:00');
  const [endTimeManual, setEndTimeManual] = useState('19:00');

  const elapsed = useStopwatch(timerStart);
  const userId  = session?.user?.id;
  const haptics = useHaptics();
  const sessionEndedRef = useRef(false);

  const finalizeWorkoutSession = useCallback(() => {
    sessionEndedRef.current = true;
    if (!userId) return;
    endWorkoutSession(userId);
    clearPlyoCheckoff(userId);
  }, [userId]);

  const [plyoSkipped, setPlyoSkipped] = useState(false);
  const plyoSession = userId ? resolvePlyoSession(workoutDate, userId) : null;
  const [plyoDone, setPlyoDone] = useState<boolean[][]>(() =>
    plyoSession && userId ? initPlyoCheckoff(userId, plyoSession) : [],
  );

  useEffect(() => {
    if (!userId || plyoSkipped) return;
    const session = resolvePlyoSession(workoutDate, userId);
    setPlyoDone(initPlyoCheckoff(userId, session));
  }, [userId, workoutDate, plyoSkipped]);

  useEffect(() => {
    if (!userId) return;
    const draft = loadWorkoutDraft(userId);
    const seed = (draft && hasResumableWorkoutDraftContent(draft)) ? draft : (initial ?? draft);
    if (!seed) return;
    setWorkoutName(seed.workoutName);
    setExercises(seed.exercises?.length ? seed.exercises : [newExercise()]);
    setActivities(seed.activities ?? []);
    setNotes(seed.notes ?? '');
    setSessionRpe(seed.sessionRpe ?? null);
    if (draft) {
      setWorkoutDate(draft.workoutDate);
      setTimerStart(draft.timerStart);
      setManualTime(draft.manualTime);
      setStartTimeManual(draft.startTimeManual);
      setEndTimeManual(draft.endTimeManual);
    }
  }, [userId, initial]);

  useEffect(() => {
    if (!userId || plyoSkipped || !plyoSession || sessionEndedRef.current) return;
    const t = window.setTimeout(() => {
      if (sessionEndedRef.current) return;
      savePlyoCheckoff(userId, plyoSession.sessionKey, plyoDone);
    }, 400);
    return () => window.clearTimeout(t);
  }, [userId, plyoSkipped, plyoSession, plyoDone]);

  const togglePlyoSet = (exIdx: number, setIdx: number) => {
    setPlyoDone((prev) =>
      prev.map((row, i) =>
        i === exIdx ? row.map((d, j) => (j === setIdx ? !d : d)) : row,
      ),
    );
  };

  useEffect(() => {
    if (!userId) return;
    markWorkoutSessionActive(userId);
  }, [userId]);

  const draftSnapshotRef = useRef<WorkoutDraft | null>(null);
  useEffect(() => {
    draftSnapshotRef.current = {
      workoutName,
      exercises,
      activities,
      notes,
      sessionRpe,
      workoutDate,
      timerStart,
      manualTime,
      startTimeManual,
      endTimeManual,
      savedAt: Date.now(),
    };
  });

  useEffect(() => {
    if (!userId) return;
    const flush = () => {
      if (sessionEndedRef.current) return;
      const draft = draftSnapshotRef.current;
      if (!draft) return;
      persistWorkoutDraft(userId, draft);
      if (!sessionEndedRef.current && plyoSession && plyoDone.length > 0) {
        savePlyoCheckoff(userId, plyoSession.sessionKey, plyoDone);
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [userId, plyoSession, plyoDone]);

  useEffect(() => {
    if (!userId || sessionEndedRef.current) return;
    const t = window.setTimeout(() => {
      if (sessionEndedRef.current) return;
      const draft = draftSnapshotRef.current;
      if (!draft) return;
      if (isWorkoutSessionActive(userId) || hasResumableWorkoutDraftContent(draft)) {
        saveWorkoutDraft(userId, draft);
      } else {
        endWorkoutSession(userId);
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [userId, workoutName, exercises, activities, notes, sessionRpe, workoutDate, timerStart, manualTime, startTimeManual, endTimeManual]);

  const hasUnsavedData = Boolean(
    workoutName.trim() || notes.trim() || sessionRpe != null ||
    exercises.some(e => e.name.trim()) || activities.some(a => a.name.trim()) ||
    plyoDone.some((row) => row.some(Boolean))
  );

  const handleBack = async () => {
    if (hasUnsavedData && !(await confirmDialog('Masz niezapisane dane treningu — wyjść bez zapisywania?'))) return;
    finalizeWorkoutSession();
    onBack();
  };

  const addExercise    = () => { haptics.light(); setExercises(p => [...p, newExercise()]); };
  const removeExercise = (id: number) => { if (exercises.length > 1) { haptics.light(); setExercises(p => p.filter(e => e.id !== id)); } };
  const updateExercise = (u: WorkoutExercise) => setExercises(p => p.map(e => e.id === u.id ? u : e));

  async function save() {
    if (!userId || saving) return;
    const validEx = exercises.filter(e => e.name.trim());
    const validAc = activities.filter(a => a.name.trim());
    const plyoLogs =
      !plyoSkipped && plyoSession
        ? plyoPrescriptionToLogs(plyoSession.exercises, plyoDone)
        : [];
    if (!validEx.length && !validAc.length && !plyoLogs.length) {
      notify('Dodaj ćwiczenia siłowe albo odhacz serie plyo', 'error');
      return;
    }

    if (manualTime) {
      if (!workoutDate) {
        notify('Wybierz datę treningu', 'error');
        return;
      }
      if (!startTimeManual || !endTimeManual) {
        notify('Podaj godzinę rozpoczęcia i zakończenia treningu', 'error');
        return;
      }
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!timeRegex.test(startTimeManual) || !timeRegex.test(endTimeManual)) {
        notify('Niepoprawny format godziny rozpoczęcia lub zakończenia', 'error');
        return;
      }
    }

    const plyoComplete = Boolean(
      !plyoSkipped && plyoSession && isPlyoSessionComplete(plyoDone),
    );

    setSaving(true);
    try {
      await supabase.auth.getSession();
      const { queued } = await saveWorkoutSession(userId, {
        workoutName,
        exercises,
        activities,
        notes,
        sessionRpe,
        workoutDate,
        timerStart,
        manualTime,
        startTimeManual,
        endTimeManual,
        plyoLogs,
      });
      if (plyoComplete) {
        advancePlyoProgram(userId);
      }
      finalizeWorkoutSession();
      haptics.success();
      if (queued) {
        notify('Brak sieci — trening zapisany lokalnie, zsynchronizuje się automatycznie', 'info');
      }
      onSaved?.();
      onBack();
    } catch (err) {
      haptics.error();
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Not authorized') || message.includes('JWT')) {
        notify('Sesja wygasła — odśwież stronę (draft treningu zostaje lokalnie)', 'error');
      } else {
        notify(message, 'error');
      }
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

      <main className="flex-1 p-5 space-y-8 max-w-md mx-auto w-full">
        {!plyoSkipped && plyoSession && plyoDone.length > 0 && !isPlyoSessionComplete(plyoDone) && (
          <PlyoBlock
            session={plyoSession}
            done={plyoDone}
            onToggleSet={togglePlyoSet}
            onSkip={() => {
              haptics.light();
              setPlyoSkipped(true);
            }}
          />
        )}

        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Nazwa (opcjonalnie)</label>
          <input type="text" value={workoutName} onChange={e => setWorkoutName(e.target.value)}
            placeholder="np. Push, Nogi, Plecy/Bicep..."
            className="w-full bg-surface-solid border border-border-custom rounded-2xl px-4 py-3 text-sm font-bold text-text-primary outline-none focus:bg-surface-solid focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)] transition-all placeholder:text-text-muted/40" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell size={12} className="text-text-muted" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-text-muted">Ćwiczenia</span>
          </div>
          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onChange={updateExercise} onRemove={() => removeExercise(ex.id)} userId={userId} />
          ))}
          <button onClick={addExercise}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border-custom bg-surface hover:bg-surface-solid hover:border-primary/45 p-3.5 text-[10px] font-black uppercase tracking-widest text-text-secondary transition-all cursor-pointer">
            <Plus size={13} /> Dodaj ćwiczenie
          </button>
          <VolumeBar exercises={exercises} />
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
